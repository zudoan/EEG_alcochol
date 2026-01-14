import glob
import os
import json
import warnings

import numpy as np

from .config import (
    DEFAULT_TRAIN_GLOB,
    DEFAULT_TEST_GLOB,
    REMOVE_TEST_DUPLICATES,
    MAX_FILES_TRAIN,
    MAX_FILES_TEST,
    RANDOM_STATE,
    SAVE_DIR,
    GRIDSEARCH_CV_SPLITS,
    RUN_TF_MODELS,
    RUN_TORCH_MODELS,
    TRAIN_VERBOSE,
)
from .eda import label_summary
from .feature_engineering import build_train_test_bundles
from .evaluation import evaluate_binary, export_models
from .diagnostics import (
    leakage_diagnostics,
    distribution_shift_diagnostics,
    data_quality_checks,
)
from .preprocessing import fit_clip_bounds, apply_clip_bounds
from sklearn.preprocessing import RobustScaler

from .model_doananhvu import train_models_doananhvu, train_swin_spectrogram_tl
from .model_nguyenhuutuanphat import train_models_nguyenhuutuanphat, train_cnn_spectrogram_grid, train_crnn_spectrogram_grid
from .model_lengoctien import train_models_lengoctien
from .model_phantrantuonvy import train_models_phantrantuonvy


"""Training entry-point.

This script runs the full pipeline in order:
1) Load file lists (train/test)
2) Label summary + leakage diagnostics
3) Build feature matrices (bandpower vector + spectrogram image)
4) Apply outlier handling (quantile clipping) on bandpower features
5) Train models and evaluate
6) Save artifacts to saved_models/ for the web dashboard
"""



def _subsample(files, max_files):
    if max_files is None:
        return files
    rng = np.random.default_rng(RANDOM_STATE)
    return list(rng.choice(files, size=min(max_files, len(files)), replace=False))


def run():
    warnings.filterwarnings('ignore', category=FutureWarning)
    warnings.filterwarnings('ignore', category=UserWarning)

    train_files = sorted(glob.glob(DEFAULT_TRAIN_GLOB, recursive=True))
    test_files = sorted(glob.glob(DEFAULT_TEST_GLOB, recursive=True))

    train_files = _subsample(train_files, MAX_FILES_TRAIN)
    test_files = _subsample(test_files, MAX_FILES_TEST)

    print('TRAIN files:', len(train_files))
    print('TEST  files:', len(test_files))

    print('\n=== Quick label distribution ===')
    ls = label_summary(train_files, test_files)
    print('TRAIN:', ls['train_counts'])
    print('TEST :', ls['test_counts'])

    print('\n=== Leakage diagnostics (hash) ===')
    leak = leakage_diagnostics(train_files, test_files)
    print(leak)

    print('\n=== Build datasets (features) ===')
    bundle = build_train_test_bundles(
        train_files=train_files,
        test_files=test_files,
        remove_test_duplicates=REMOVE_TEST_DUPLICATES,
    )

    print('\n=== Outlier handling (bandpower) ===')
    clip_bounds = fit_clip_bounds(bundle.X_bp_train, lo_q=0.01, hi_q=0.99)
    X_bp_train_clip = apply_clip_bounds(bundle.X_bp_train, clip_bounds)
    X_bp_test_clip = apply_clip_bounds(bundle.X_bp_test, clip_bounds)

    print('X_bp_train:', bundle.X_bp_train.shape, 'X_bp_test:', bundle.X_bp_test.shape)
    print('X_spec_train:', bundle.X_spec_train.shape, 'X_spec_test:', bundle.X_spec_test.shape)
    print('dropped_test:', len(bundle.dropped_test))

    print('\n=== Distribution shift diagnostics ===')
    shift = distribution_shift_diagnostics(X_bp_train_clip, X_bp_test_clip, bp_cols_ref=bundle.bp_cols_ref)
    print('top_mean_shift[0:5]:', shift['top_mean_shift'][:5])
    if shift['ks'] is not None:
        print('ks_sig_count:', shift['ks']['sig_count'])

    print('\n=== Data quality checks ===')
    dq_bp = data_quality_checks(X_bp_train_clip, feature_names=bundle.bp_cols_ref)
    print('bandpower_train:', dq_bp)
    dq_sp = data_quality_checks(bundle.X_spec_train.reshape(len(bundle.X_spec_train), -1))
    print('spectrogram_train_flat:', dq_sp)

    print('\n=== Train models ===')
    results = {}

    scaler_bp = RobustScaler()
    Xtr_bp = scaler_bp.fit_transform(X_bp_train_clip)
    Xte_bp = scaler_bp.transform(X_bp_test_clip)

    results.update(train_models_doananhvu(Xtr_bp, bundle.y_train, Xte_bp, bundle.y_test, random_state=RANDOM_STATE, cv_splits=GRIDSEARCH_CV_SPLITS, verbose=TRAIN_VERBOSE))
    results.update(train_models_nguyenhuutuanphat(Xtr_bp, bundle.y_train, Xte_bp, bundle.y_test, random_state=RANDOM_STATE, cv_splits=GRIDSEARCH_CV_SPLITS, verbose=TRAIN_VERBOSE))
    results.update(train_models_lengoctien(Xtr_bp, bundle.y_train, Xte_bp, bundle.y_test, random_state=RANDOM_STATE, cv_splits=GRIDSEARCH_CV_SPLITS, verbose=TRAIN_VERBOSE))
    results.update(train_models_phantrantuonvy(Xtr_bp, bundle.y_train, Xte_bp, bundle.y_test, random_state=RANDOM_STATE, cv_splits=GRIDSEARCH_CV_SPLITS, verbose=TRAIN_VERBOSE))

    if RUN_TF_MODELS:
        cnn_info = train_cnn_spectrogram_grid(
            bundle.X_spec_train,
            bundle.y_train,
            bundle.X_spec_test,
            bundle.y_test,
            random_state=RANDOM_STATE,
            verbose=TRAIN_VERBOSE,
        )
        if cnn_info is not None:
            results['NguyenHuuTuanPhat - CNN (Spectrogram)'] = cnn_info

        crnn_info = train_crnn_spectrogram_grid(
            bundle.X_spec_train,
            bundle.y_train,
            bundle.X_spec_test,
            bundle.y_test,
            random_state=RANDOM_STATE,
            verbose=TRAIN_VERBOSE,
        )
        if crnn_info is not None:
            results['NguyenHuuTuanPhat - CRNN (Spectrogram)'] = crnn_info
    else:
        print('Skip TF models (CNN/CRNN). Set RUN_TF_MODELS=1 to enable.')

    if RUN_TORCH_MODELS:
        swin_info = train_swin_spectrogram_tl(
            bundle.X_spec_train,
            bundle.y_train,
            bundle.X_spec_test,
            bundle.y_test,
            random_state=RANDOM_STATE,
            verbose=TRAIN_VERBOSE,
        )
        if swin_info is not None:
            results['DoanAnhVu - Swin (Spectrogram)'] = swin_info
    else:
        print('Skip Torch models (Swin). Set RUN_TORCH_MODELS=1 to enable.')

    print('\n=== Build EDA summary (for dashboard) ===')
    # 1) Feature importance (quick, interpretable)
    feat_imp = {}
    try:
        for name, info in results.items():
            model_obj = info.get('model_obj')
            if model_obj is None:
                continue

            imp = None
            if hasattr(model_obj, 'feature_importances_'):
                try:
                    v = np.asarray(model_obj.feature_importances_, dtype=float)
                    imp = v
                except Exception:
                    imp = None
            elif hasattr(model_obj, 'coef_'):
                try:
                    v = np.asarray(model_obj.coef_, dtype=float).reshape(-1)
                    imp = np.abs(v)
                except Exception:
                    imp = None

            if imp is None or imp.ndim != 1 or len(imp) != len(bundle.bp_cols_ref):
                continue

            idx = np.argsort(imp)[::-1][:25]
            feat_imp[name] = [
                {'feature': bundle.bp_cols_ref[int(i)], 'importance': float(imp[int(i)])}
                for i in idx
            ]
    except Exception:
        feat_imp = {}

    # 2) Scalp summary: mean bandpower per channel per band (from bp feature matrix)
    scalp = {}
    try:
        cols = bundle.bp_cols_ref
        X = bundle.X_bp_train
        # Parse bp_{band}_{ch}
        band_ch_to_idx = {}
        for j, col in enumerate(cols):
            if not col.startswith('bp_'):
                continue
            parts = col.split('_', 2)
            if len(parts) != 3:
                continue
            _, band, ch = parts
            band_ch_to_idx.setdefault(band, {}).setdefault(ch, []).append(j)

        for band, chmap in band_ch_to_idx.items():
            out = []
            for ch, idxs in chmap.items():
                # if duplicated columns exist for some reason, average them
                v = float(np.nanmean(np.nanmean(X[:, idxs], axis=1)))
                out.append({'channel': ch, 'value': v})
            out.sort(key=lambda x: abs(x['value']), reverse=True)
            scalp[band] = out
    except Exception:
        scalp = {}

    # 3) PCA points (downsample for web)
    pca_points = []
    try:
        Z = np.asarray(shift.get('pca_Z'))
        n_tr = len(bundle.X_bp_train)
        n_te = len(bundle.X_bp_test)
        # Z corresponds to stacked [train; test]
        Z_tr = Z[:n_tr]
        Z_te = Z[n_tr:n_tr + n_te]
        rng = np.random.default_rng(RANDOM_STATE)
        k_tr = min(500, len(Z_tr))
        k_te = min(500, len(Z_te))
        it = rng.choice(len(Z_tr), size=k_tr, replace=False) if len(Z_tr) > 0 else []
        ie = rng.choice(len(Z_te), size=k_te, replace=False) if len(Z_te) > 0 else []
        for i in it:
            pca_points.append({'x': float(Z_tr[int(i), 0]), 'y': float(Z_tr[int(i), 1]), 'split': 'train'})
        for i in ie:
            pca_points.append({'x': float(Z_te[int(i), 0]), 'y': float(Z_te[int(i), 1]), 'split': 'test'})
    except Exception:
        pca_points = []

    ks_summary = None
    try:
        ks = shift.get('ks', None)
        if ks is not None:
            pvals = ks.get('pvals', None)
            pvals = np.asarray(pvals, dtype=float) if pvals is not None else None
            ks_summary = {
                'alpha': float(ks.get('alpha', 0.01)),
                'sig_count': int(ks.get('sig_count', 0)),
            }
            if pvals is not None and pvals.size > 0:
                ks_summary.update({
                    'pval_min': float(np.nanmin(pvals)),
                    'pval_p10': float(np.nanquantile(pvals, 0.10)),
                    'pval_median': float(np.nanmedian(pvals)),
                })
    except Exception:
        ks_summary = None

    eda_obj = {
        'label_summary': {
            'train_counts': [int(x) for x in ls['train_counts']],
            'test_counts': [int(x) for x in ls['test_counts']],
        },
        'leakage': leak,
        'dataset_shapes': {
            'X_bp_train': [int(bundle.X_bp_train.shape[0]), int(bundle.X_bp_train.shape[1])],
            'X_bp_test': [int(bundle.X_bp_test.shape[0]), int(bundle.X_bp_test.shape[1])],
            'X_spec_train': [int(bundle.X_spec_train.shape[0]), int(bundle.X_spec_train.shape[1]), int(bundle.X_spec_train.shape[2])],
            'X_spec_test': [int(bundle.X_spec_test.shape[0]), int(bundle.X_spec_test.shape[1]), int(bundle.X_spec_test.shape[2])],
            'dropped_test': int(len(bundle.dropped_test)),
        },
        'distribution_shift': {
            'top_mean_shift': shift.get('top_mean_shift', []),
            'ks': ks_summary,
            'pca_points': pca_points,
        },
        'data_quality': {
            'bandpower_train': dq_bp,
        },
        'feature_importance': feat_imp,
        'scalp_bandpower': scalp,
        'actions_taken': [
            {
                'topic': 'Missing value',
                'how': 'Loại kênh có tỷ lệ thiếu > 5%, sau đó nội suy theo thời gian (interpolate) + bfill/ffill.',
            },
            {
                'topic': 'Rò rỉ dữ liệu',
                'how': 'Tính MD5 train/test, loại file test trùng nội dung với train (nếu bật REMOVE_TEST_DUPLICATES).',
            },
            {
                'topic': 'Outlier / lệch phân phối',
                'how': 'Clip outlier cho feature bandpower theo quantile train (q=1%..99%), sau đó theo dõi skew/outlier theo IQR & z-score; chẩn đoán shift train/test theo chênh mean và PCA.',
            },
            {
                'topic': 'Chuẩn hoá feature',
                'how': 'Dùng RobustScaler cho vector bandpower trước khi train các model tuyến tính/KNN/MLP.',
            },
        ],
    }

    try:
        os.makedirs(SAVE_DIR, exist_ok=True)
        # Save clip bounds so inference can apply the same preprocessing
        clip_path = os.path.join(SAVE_DIR, 'bp_clip_bounds.json')
        with open(clip_path, 'w', encoding='utf-8') as f:
            json.dump(
                {
                    'method': clip_bounds.get('method'),
                    'lo_q': float(clip_bounds.get('lo_q', 0.01)),
                    'hi_q': float(clip_bounds.get('hi_q', 0.99)),
                    'lo': [float(x) for x in np.asarray(clip_bounds.get('lo')).ravel()],
                    'hi': [float(x) for x in np.asarray(clip_bounds.get('hi')).ravel()],
                },
                f,
                ensure_ascii=False,
                indent=2,
            )
        out_path = os.path.join(SAVE_DIR, 'eda.json')
        tmp_path = os.path.join(SAVE_DIR, 'eda.json.tmp')
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump({'eda': eda_obj}, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, out_path)
        print('Saved eda.json')
    except Exception as e:
        print('Failed to save eda.json:', repr(e))

    print('\n=== Evaluate ===')
    metrics = []
    for name, info in results.items():
        m = evaluate_binary(name, bundle.y_test, info['y_pred'], info.get('y_prob'))
        metrics.append(m)
        print(name, 'acc=', m['accuracy'], 'auc=', m['roc_auc'])

    best = sorted([m for m in metrics if m['roc_auc'] is not None], key=lambda x: x['roc_auc'], reverse=True)
    if len(best) > 0:
        print('\nBest by AUC:', best[0]['name'], best[0]['roc_auc'])

    try:
        os.makedirs(SAVE_DIR, exist_ok=True)
        with open(os.path.join(SAVE_DIR, 'metrics.json'), 'w', encoding='utf-8') as f:
            json.dump({'metrics': metrics}, f, ensure_ascii=False, indent=2)
        print('Saved metrics.json')
    except Exception as e:
        print('Failed to save metrics.json:', repr(e))

    print('\n=== Export models ===')
    saved = export_models(results, SAVE_DIR, scaler_bp=scaler_bp)
    print('Saved:', saved)


if __name__ == '__main__':
    run()
