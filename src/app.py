import io
import os
import tempfile
from typing import Optional, Dict, Any, List
import json

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import SAVE_DIR, DEFAULT_TRAIN_GLOB, DEFAULT_TEST_GLOB
from .config import BANDS, FS, EOG_CLEAN
from .config import EOG_HIGHPASS_HZ, EOG_ICA_N_COMPONENTS, EOG_CORR_THRESHOLD
from .preprocessing import (
    extract_features_from_file,
    normalize_long_df,
    build_epoch_matrix_from_long,
    eog_clean_epoch_matrix,
    welch_psd_features,
    bandpower,
    spectrogram_tf,
    apply_clip_bounds,
)


def _load_best_sklearn_model(saved_dir: str):
    try:
        import joblib
    except Exception as e:
        raise RuntimeError(f'joblib not available: {e!r}')

    if not os.path.isdir(saved_dir):
        raise RuntimeError(f'saved_models dir not found: {saved_dir}')

    # Prefer BEST__*.joblib
    candidates = []
    for fn in os.listdir(saved_dir):
        if fn.startswith('BEST__') and fn.endswith('.joblib'):
            candidates.append(fn)
    if not candidates:
        # fallback: any joblib (prefer XGBoost, then LogReg, then any)
        preferred = [
            'XGBoost (Bandpower).joblib',
            'Logistic Regression (Bandpower).joblib',
            'DoanAnhVu - ANN_MLP (Bandpower).joblib',
            'DoanAnhVu - ANN/MLP (Bandpower).joblib',
            'KNN (Bandpower).joblib',
            'Random Forest (Bandpower).joblib',
        ]
        for p in preferred:
            if os.path.exists(os.path.join(saved_dir, p)):
                candidates.append(p)
                break
        if not candidates:
            for fn in os.listdir(saved_dir):
                if fn.endswith('.joblib') and fn != 'scaler_bp.joblib':
                    candidates.append(fn)
                    break

    if not candidates:
        raise RuntimeError('No sklearn .joblib model found in saved_models/')

    model_path = os.path.join(saved_dir, candidates[0])
    model = joblib.load(model_path)

    scaler_path = os.path.join(saved_dir, 'scaler_bp.joblib')
    scaler = None
    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)

    return model_path, model, scaler


def _canonical_models() -> List[str]:
    return [
        'DoanAnhVu - XGBoost (Bandpower).joblib',
        # NOTE: training export uses safe_filename(), so '/' becomes '_' in the saved filename.
        'DoanAnhVu - ANN_MLP (Bandpower).joblib',
        # keep legacy name for compatibility if a file was manually renamed
        'DoanAnhVu - ANN/MLP (Bandpower).joblib',
        'NguyenHuuTuanPhat - Random Forest (Bandpower).joblib',
        'LeNgocTien - KNN (Bandpower).joblib',
        'PhanTranTuonVy - Logistic Regression (Bandpower).joblib',
        'NguyenHuuTuanPhat - CNN (Spectrogram).keras',
        'NguyenHuuTuanPhat - CRNN (Spectrogram).keras',
        'DoanAnhVu - Swin (Spectrogram).pt',
    ]


def _resolve_model_path(saved_dir: str, model_name: Optional[str]) -> Optional[str]:
    if model_name is None:
        return None
    model_name = str(model_name).strip()
    if not model_name:
        return None
    p = os.path.join(saved_dir, model_name)
    if not os.path.exists(p):
        raise HTTPException(status_code=400, detail=f'Model not found: {model_name}')
    return p


def _load_any_model(model_path: str):
    ext = os.path.splitext(model_path)[-1].lower()
    if ext == '.joblib':
        try:
            import joblib
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'joblib not available: {e!r}')
        return 'joblib', joblib.load(model_path)

    if ext == '.keras':
        try:
            import tensorflow as tf
            from tensorflow import keras
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'tensorflow not available: {e!r}')
        return 'keras', keras.models.load_model(model_path)

    if ext in ('.pt', '.pth'):
        try:
            import torch
            from transformers import SwinForImageClassification
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'torch/transformers not available: {e!r}')

        ckpt = torch.load(model_path, map_location='cpu')
        meta = ckpt.get('meta', {}) if isinstance(ckpt, dict) else {}
        model_name = meta.get('model_name', 'microsoft/swin-tiny-patch4-window7-224')
        model = SwinForImageClassification.from_pretrained(model_name, num_labels=2, ignore_mismatched_sizes=True)
        state = ckpt.get('state_dict', None) if isinstance(ckpt, dict) else None
        if state is not None:
            model.load_state_dict(state, strict=False)
        model.eval()
        return 'torch_swin', {'model': model, 'meta': meta}

    raise HTTPException(status_code=400, detail=f'Unsupported model type: {ext}')


def _load_bp_clip_bounds(saved_dir: str) -> Dict[str, Any] | None:
    p = os.path.join(saved_dir, 'bp_clip_bounds.json')
    if not os.path.exists(p):
        return None
    try:
        with open(p, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        lo = obj.get('lo', None)
        hi = obj.get('hi', None)
        if lo is None or hi is None:
            return None
        return {
            'method': obj.get('method', 'quantile_clip'),
            'lo_q': float(obj.get('lo_q', 0.01)),
            'hi_q': float(obj.get('hi_q', 0.99)),
            'lo': np.asarray(lo, dtype=np.float32),
            'hi': np.asarray(hi, dtype=np.float32),
        }
    except Exception:
        return None


def _predict_with_loaded_model(
    *,
    model_kind: str,
    model: Any,
    model_path: str,
    out: Dict[str, Any],
    x_bp: np.ndarray,
    clip_bounds: Dict[str, Any] | None,
    scaler: Any,
) -> Dict[str, Any]:
    if model_kind == 'joblib':
        x_in = x_bp
        if clip_bounds is not None:
            try:
                x_in = apply_clip_bounds(x_in, clip_bounds)
            except Exception:
                pass

        if scaler is not None:
            try:
                x_in = scaler.transform(x_in)
            except Exception:
                pass

        if hasattr(model, 'predict_proba'):
            prob = float(model.predict_proba(x_in)[:, 1][0])
        else:
            pred = int(model.predict(x_in)[0])
            prob = float(pred)
    if model_kind == 'keras':
        spec_img = np.asarray(out['spec_img'], dtype=np.float32)
        x_spec = spec_img[None, ..., None]

        if 'CNN (Spectrogram)' in os.path.basename(model_path) or 'CRNN (Spectrogram)' in os.path.basename(model_path):
            mu = float(x_spec.mean())
            sd = float(x_spec.std())
            x_in = (x_spec - mu) / (sd + 1e-6)
            prob = float(np.asarray(model.predict(x_in, verbose=0)).reshape(-1)[0])
        else:
            try:
                import tensorflow as tf
            except Exception as e:
                raise HTTPException(status_code=500, detail=f'tensorflow not available: {e!r}')

            vmin = float(x_spec.min())
            vmax = float(x_spec.max())
            x01 = (x_spec - vmin) / (vmax - vmin + 1e-6)
            x255 = x01 * 255.0
            X = tf.convert_to_tensor(x255, dtype=tf.float32)
            X = tf.image.resize(X, (224, 224), method='bilinear')
            X = tf.repeat(X, repeats=3, axis=-1)
            prob = float(np.asarray(model.predict(X, verbose=0)).reshape(-1)[0])

        pred_label = int(prob >= 0.5)
        return {
            'model_path': model_path,
            'model_name': os.path.basename(model_path),
            'pred_label': pred_label,
            'pred_prob': prob,
            'note': 'pred_label: 1=a (alcoholic), 0=c (control)',
        }

    if model_kind == 'torch_swin':
        try:
            import torch
            from torch import nn
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'torch not available: {e!r}')

        pack = model
        m = pack.get('model')
        meta = pack.get('meta', {})

        spec_img = np.asarray(out['spec_img'], dtype=np.float32)
        x = spec_img[None, None, :, :]
        vmin = float(meta.get('vmin', float(x.min())))
        vmax = float(meta.get('vmax', float(x.max())))
        x01 = (x - vmin) / (vmax - vmin + 1e-6)

        xt = torch.from_numpy(x01.astype(np.float32))
        xt = nn.functional.interpolate(xt, size=(224, 224), mode='bilinear', align_corners=False)
        xt = xt.repeat(1, 3, 1, 1)

        # If training used ImageNet normalization, apply it for inference too.
        mean = meta.get('imagenet_mean', None)
        std = meta.get('imagenet_std', None)
        if mean is not None and std is not None:
            try:
                mean_t = torch.tensor(mean, dtype=torch.float32).view(1, 3, 1, 1)
                std_t = torch.tensor(std, dtype=torch.float32).view(1, 3, 1, 1)
                xt = (xt - mean_t) / std_t
            except Exception:
                pass

        with torch.no_grad():
            out_t = m(pixel_values=xt)
            p = torch.softmax(out_t.logits, dim=-1)[:, 1]
            prob = float(p.detach().cpu().numpy().reshape(-1)[0])

        pred_label = int(prob >= 0.5)
        return {
            'model_path': model_path,
            'model_name': os.path.basename(model_path),
            'pred_label': pred_label,
            'pred_prob': prob,
            'note': 'pred_label: 1=a (alcoholic), 0=c (control)',
        }

    raise HTTPException(status_code=400, detail=f'Unsupported model kind: {model_kind}')


def _read_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or '')[-1] or '.csv'
    if suffix.lower() != '.csv':
        raise HTTPException(status_code=400, detail='Only .csv files are supported')

    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix='eeg_upload_')
    os.close(fd)

    try:
        content = upload.file.read()
        with open(tmp_path, 'wb') as f:
            f.write(content)
        return tmp_path
    except Exception as e:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f'Failed to read upload: {e!r}')


app = FastAPI(title='EEG Alcoholism Dashboard API', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return {'ok': True}


@app.get('/models')
def list_models():
    if not os.path.isdir(SAVE_DIR):
        return {'models': [], 'note': f'{SAVE_DIR} not found'}
    allow = set(_canonical_models())
    items = []
    for fn in sorted(os.listdir(SAVE_DIR)):
        if fn in allow:
            items.append(fn)
    return {'models': items, 'note': 'Chỉ hiển thị 7 model chính của nhóm.'}


@app.get('/metrics')
def metrics():
    if not os.path.isdir(SAVE_DIR):
        return {'metrics': [], 'note': f'{SAVE_DIR} not found'}

    p = os.path.join(SAVE_DIR, 'metrics.json')
    if not os.path.exists(p):
        return {
            'metrics': [],
            'note': 'metrics.json not found. Run training pipeline (python -m src.main) to generate it.',
        }

    try:
        with open(p, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        return obj
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to read metrics.json: {e!r}')


@app.get('/eda')
def eda():
    if not os.path.isdir(SAVE_DIR):
        return {'eda': None, 'note': f'{SAVE_DIR} not found'}

    p = os.path.join(SAVE_DIR, 'eda.json')
    if not os.path.exists(p):
        return {
            'eda': None,
            'note': 'eda.json not found. Run training pipeline (python -m src.main) to generate it.',
        }

    try:
        with open(p, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        obj.setdefault('runtime', {})
        obj['runtime']['eog_clean'] = {
            'enabled': bool(EOG_CLEAN),
            'highpass_hz': float(EOG_HIGHPASS_HZ),
            'ica_n_components': int(EOG_ICA_N_COMPONENTS),
            'corr_threshold': float(EOG_CORR_THRESHOLD),
            'method': 'highpass + FastICA (remove EOG-like components by corr with frontal reference)',
        }
        return obj
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to read eda.json: {e!r}')


@app.post('/analyze')
def analyze(file: UploadFile = File(...)):
    tmp_path = _read_upload_to_temp(file)
    try:
        # 1) Build rich signals from raw
        import pandas as pd

        df_raw = pd.read_csv(tmp_path)
        df_raw['source_file'] = os.path.basename(tmp_path)
        df_long = normalize_long_df(df_raw)
        trial_number = int(df_long['trial_number'].iloc[0])

        x_ch_t, ch_names = build_epoch_matrix_from_long(df_long, trial_number=trial_number)

        if EOG_CLEAN:
            x_ch_t = eog_clean_epoch_matrix(x_ch_t, ch_names, fs=FS)

        # time-series: return all channels (downsampled) so frontend can switch channels
        ch0 = ch_names[0] if len(ch_names) > 0 else 'unknown'
        n = int(x_ch_t.shape[1])
        max_points = 512
        step = max(1, int(np.ceil(n / max_points)))

        timeseries_by_channel = {}
        for ci, ch in enumerate(ch_names):
            ts = x_ch_t[ci]
            pts = [{'t': int(i), 'v': float(ts[i])} for i in range(0, n, step)]
            timeseries_by_channel[str(ch)] = pts

        ts_points = timeseries_by_channel.get(ch0, [])

        # 2) PSD + bandpower (avg over channels) for charts
        freqs, psd = welch_psd_features(x_ch_t, fs=FS, nperseg=128)
        psd_mean = psd.mean(axis=0)
        psd_points = [{'f': float(freqs[i]), 'p': float(psd_mean[i])} for i in range(len(freqs))]

        bp_by_band = []
        for bname, brange in BANDS.items():
            bp = bandpower(psd, freqs, brange)
            bp_by_band.append({'band': bname, 'value': float(bp.mean())})

        # 3) Spectrogram matrix (already small: 46x13 by default)
        f, t, s = spectrogram_tf(x_ch_t, fs=FS, nperseg=64, noverlap=48, nfft=256, fmax=45)
        spec = np.log10(s.mean(axis=0) + 1e-12).astype(np.float32)

        # 4) Reuse existing feature extractor to keep consistent with training pipeline
        out = extract_features_from_file(tmp_path)
        bp_feats = out['bp_feats']
        idx = np.argsort(np.abs(bp_feats))[::-1][:10]
        top = [{'feature': out['bp_cols'][j], 'value': float(bp_feats[j])} for j in idx]

        resp = {
            'trial_number': int(trial_number),
            'channel_used_for_timeseries': ch0,
            'charts': {
                'timeseries': ts_points,
                'timeseries_by_channel': timeseries_by_channel,
                'channels': [str(c) for c in ch_names],
                'psd': psd_points,
                'bandpower_by_band': bp_by_band,
                'spectrogram': {
                    'f': [float(x) for x in f],
                    't': [float(x) for x in t],
                    'z': spec.tolist(),
                    'shape': [int(spec.shape[0]), int(spec.shape[1])],
                    'min': float(spec.min()),
                    'max': float(spec.max()),
                },
                'bandpower_top10': top,
            },
            'preprocessing_summary': {
                'fs_hz': FS,
                'n_samples': int(x_ch_t.shape[1]),
                'channels_used': len(ch_names),
                'missing_policy': 'Loại kênh có tỷ lệ thiếu > 5%, sau đó nội suy theo thời gian (interpolate) + bfill/ffill',
                'artifact_removal': {
                    'eog_clean_enabled': bool(EOG_CLEAN),
                    'method': 'highpass + FastICA (remove EOG-like components by corr with frontal reference)',
                    'params': {
                        'highpass_hz': float(EOG_HIGHPASS_HZ),
                        'ica_n_components': int(EOG_ICA_N_COMPONENTS),
                        'corr_threshold': float(EOG_CORR_THRESHOLD),
                    },
                },
                'features': [
                    'Welch PSD (mật độ phổ công suất)',
                    'Bandpower theo dải tần (delta/theta/alpha/beta/gamma)',
                    'Spectrogram (phổ theo thời gian) lấy log10 và trung bình qua kênh',
                ],
            },
            'eeg_bands_explain': [
                {'band': 'delta (0.5–4Hz)', 'meaning': 'Liên quan ngủ sâu; tăng bất thường có thể phản ánh rối loạn/ức chế thần kinh.'},
                {'band': 'theta (4–8Hz)', 'meaning': 'Buồn ngủ/giảm tỉnh táo; liên quan xử lý trí nhớ và trạng thái thư giãn.'},
                {'band': 'alpha (8–13Hz)', 'meaning': 'Thư giãn tỉnh (nhắm mắt), giảm khi tập trung; hay dùng để đánh giá mức độ tỉnh táo.'},
                {'band': 'beta (13–30Hz)', 'meaning': 'Tỉnh táo, hoạt động nhận thức; tăng có thể liên quan căng thẳng/kích thích.'},
                {'band': 'gamma (30–45Hz)', 'meaning': 'Xử lý thông tin nhanh; dễ nhiễu bởi cơ (EMG) nên cần cẩn trọng diễn giải.'},
            ],
        }
        return resp
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.post('/predict')
def predict(file: UploadFile = File(...), model_name: Optional[str] = None):
    tmp_path = _read_upload_to_temp(file)
    try:
        out = extract_features_from_file(tmp_path)
        x_bp = out['bp_feats'].reshape(1, -1)

        clip_bounds = _load_bp_clip_bounds(SAVE_DIR)

        selected_path = _resolve_model_path(SAVE_DIR, model_name)
        if selected_path is None:
            model_path, model, scaler = _load_best_sklearn_model(SAVE_DIR)
            model_kind = 'joblib'
        else:
            model_path = selected_path
            model_kind, model = _load_any_model(model_path)
            scaler_path = os.path.join(SAVE_DIR, 'scaler_bp.joblib')
            scaler = None
            if model_kind == 'joblib' and os.path.exists(scaler_path):
                try:
                    import joblib

                    scaler = joblib.load(scaler_path)
                except Exception:
                    scaler = None

        if model_kind == 'joblib':
            pass

        return _predict_with_loaded_model(
            model_kind=model_kind,
            model=model,
            model_path=model_path,
            out=out,
            x_bp=x_bp,
            clip_bounds=clip_bounds,
            scaler=scaler,
        )
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.post('/predict_all')
def predict_all(file: UploadFile = File(...)):
    tmp_path = _read_upload_to_temp(file)
    try:
        out = extract_features_from_file(tmp_path)
        x_bp = out['bp_feats'].reshape(1, -1)

        clip_bounds = _load_bp_clip_bounds(SAVE_DIR)

        scaler = None
        scaler_path = os.path.join(SAVE_DIR, 'scaler_bp.joblib')
        if os.path.exists(scaler_path):
            try:
                import joblib

                scaler = joblib.load(scaler_path)
            except Exception:
                scaler = None

        results = []
        allow = [m for m in _canonical_models() if os.path.exists(os.path.join(SAVE_DIR, m))]
        for model_name in allow:
            model_path = os.path.join(SAVE_DIR, model_name)
            try:
                model_kind, model = _load_any_model(model_path)
                item = _predict_with_loaded_model(
                    model_kind=model_kind,
                    model=model,
                    model_path=model_path,
                    out=out,
                    x_bp=x_bp,
                    clip_bounds=clip_bounds,
                    scaler=scaler if model_kind == 'joblib' else None,
                )
                results.append(item)
            except HTTPException as e:
                results.append({'model_name': model_name, 'model_path': model_path, 'error': e.detail})
            except Exception as e:
                results.append({'model_name': model_name, 'model_path': model_path, 'error': repr(e)})

        return {'results': results, 'count': len(results)}
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
