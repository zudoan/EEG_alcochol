import os
from typing import Optional, Tuple, List, Dict, Any

import numpy as np
import pandas as pd
from scipy.signal import welch, spectrogram, butter, filtfilt

from .config import FS, N_SAMPLES, BANDS
from .config import EOG_CLEAN, EOG_HIGHPASS_HZ, EOG_ICA_N_COMPONENTS, EOG_CORR_THRESHOLD


def fit_clip_bounds(
    X: np.ndarray,
    lo_q: float = 0.01,
    hi_q: float = 0.99,
) -> Dict[str, Any]:
    """Fit per-feature clipping bounds using training data only.

    Using quantiles is robust for heavy-tailed bandpower features.
    """
    X = np.asarray(X, dtype=np.float32)
    if X.ndim != 2:
        raise ValueError('fit_clip_bounds expects a 2D array')
    lo = np.nanquantile(X, lo_q, axis=0).astype(np.float32)
    hi = np.nanquantile(X, hi_q, axis=0).astype(np.float32)
    return {
        'method': 'quantile_clip',
        'lo_q': float(lo_q),
        'hi_q': float(hi_q),
        'lo': lo,
        'hi': hi,
    }


def apply_clip_bounds(X: np.ndarray, bounds: Dict[str, Any]) -> np.ndarray:
    """Apply clipping bounds to data (train/test/inference)."""
    if bounds is None:
        return np.asarray(X, dtype=np.float32)
    lo = np.asarray(bounds.get('lo', None), dtype=np.float32)
    hi = np.asarray(bounds.get('hi', None), dtype=np.float32)
    X = np.asarray(X, dtype=np.float32)
    if X.ndim == 1:
        return np.clip(X, lo, hi).astype(np.float32)
    if X.ndim != 2:
        raise ValueError('apply_clip_bounds expects a 1D or 2D array')
    return np.clip(X, lo[None, :], hi[None, :]).astype(np.float32)


def normalize_long_df(df_raw: pd.DataFrame) -> pd.DataFrame:
    """Normalize raw CSV dataframe into a long-form dataframe with consistent columns.

    Expected input is a SMNI_CMI CSV loaded by pandas.
    This function:
    - Maps labels: subject identifier 'a'/'c' -> 1/0
    - Normalizes column names to snake_case
    - Renames sensor_position -> channel for consistent downstream processing
    """
    df = df_raw.copy()
    df['label'] = df['subject identifier'].map({'a': 1, 'c': 0})
    df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
    df.rename(columns={'sensor_position': 'channel', 'channel': 'channel_id'}, inplace=True)
    return df


def build_epoch_matrix_from_long(
    df_long: pd.DataFrame,
    trial_number: Optional[int] = None,
    channels_keep=None,
) -> Tuple[np.ndarray, List[str]]:
    """Build EEG matrix of shape (n_channels, n_samples) for one trial.

    Steps:
    - Filter by trial_number (if provided)
    - Pivot long-form table into channel x sample_num matrix
    - Reindex to ensure exactly N_SAMPLES time points
    - Drop channels with too much missing data (>5%)
    - Interpolate missing values along time axis

    Returns
    - x_ch_t: np.ndarray [n_channels, N_SAMPLES]
    - ch_names: list of channel names (rows)
    """
    sub = df_long
    if trial_number is not None:
        sub = sub[sub['trial_number'] == trial_number]
    if channels_keep is not None:
        sub = sub[sub['channel'].isin(channels_keep)]

    mat = sub.pivot_table(index='channel', columns='sample_num', values='sensor_value', aggfunc='mean')
    mat = mat.reindex(columns=list(range(N_SAMPLES)))

    missing_ratio = mat.isna().mean(axis=1)
    mat = mat[missing_ratio < 0.05]

    mat = mat.interpolate(axis=1, limit_direction='both').bfill(axis=1).ffill(axis=1)

    return mat.values.astype(np.float32), mat.index.tolist()


def welch_psd_features(x_ch_t: np.ndarray, fs=FS, nperseg=128):
    """Compute power spectral density (PSD) per channel using Welch method."""
    freqs, psd = welch(x_ch_t, fs=fs, nperseg=nperseg, axis=1)
    return freqs.astype(np.float32), psd.astype(np.float32)


def bandpower(psd: np.ndarray, freqs: np.ndarray, band):
    """Integrate PSD within a frequency band to get bandpower per channel."""
    from scipy.integrate import trapezoid

    lo, hi = band
    mask = (freqs >= lo) & (freqs <= hi)
    if mask.sum() < 2:
        return np.zeros((psd.shape[0],), dtype=np.float32)
    return trapezoid(psd[:, mask], freqs[mask], axis=1).astype(np.float32)


def spectrogram_tf(x_ch_t: np.ndarray, fs=FS, nperseg=64, noverlap=48, nfft=256, fmax=45):
    """Compute time-frequency spectrogram (PSD over time) for each channel.

    Returns
    - f: frequency bins
    - t: time bins
    - s: spectrogram tensor [n_channels, n_freq, n_time]
    """
    c, _ = x_ch_t.shape
    all_sxx = []
    for ci in range(c):
        f, t, sxx = spectrogram(
            x_ch_t[ci],
            fs=fs,
            nperseg=nperseg,
            noverlap=noverlap,
            nfft=nfft,
            scaling='density',
            mode='psd',
        )
        all_sxx.append(sxx)

    f = f.astype(np.float32)
    t = t.astype(np.float32)
    s = np.stack(all_sxx, axis=0).astype(np.float32)

    if fmax is not None:
        m = f <= fmax
        f = f[m]
        s = s[:, m, :]

    return f, t, s


def _highpass_1d(x: np.ndarray, fs: float, cutoff_hz: float, order: int = 3) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32)
    if cutoff_hz is None:
        return x
    cutoff_hz = float(cutoff_hz)
    if cutoff_hz <= 0:
        return x
    nyq = 0.5 * float(fs)
    wn = cutoff_hz / nyq
    if wn >= 1.0:
        return x
    b, a = butter(order, wn, btype='highpass')
    return filtfilt(b, a, x, axis=-1).astype(np.float32)


def eog_clean_epoch_matrix(
    x_ch_t: np.ndarray,
    ch_names: List[str],
    *,
    fs: float = FS,
    highpass_hz: float = EOG_HIGHPASS_HZ,
    n_components: int = EOG_ICA_N_COMPONENTS,
    corr_threshold: float = EOG_CORR_THRESHOLD,
) -> np.ndarray:
    x_ch_t = np.asarray(x_ch_t, dtype=np.float32)
    if x_ch_t.ndim != 2:
        return x_ch_t
    n_ch, n_t = x_ch_t.shape
    if n_ch < 2 or n_t < 8:
        return x_ch_t

    try:
        from sklearn.decomposition import FastICA
    except Exception:
        return x_ch_t

    ch_upper = [str(c).upper() for c in ch_names]
    frontal_set = {'FP1', 'FP2', 'AF7', 'AF8', 'F7', 'F8', 'FZ', 'FPZ', 'AFZ'}
    frontal_idx = [i for i, c in enumerate(ch_upper) if c in frontal_set]
    if not frontal_idx:
        return x_ch_t

    x_hp = np.stack([_highpass_1d(x_ch_t[i], fs=fs, cutoff_hz=highpass_hz) for i in range(n_ch)], axis=0)
    eog_ref = x_hp[frontal_idx].mean(axis=0)
    eog_ref = (eog_ref - float(eog_ref.mean())) / (float(eog_ref.std()) + 1e-6)

    X = x_hp.T
    n_components = int(n_components)
    if n_components <= 0:
        n_components = min(n_ch, 12)
    n_components = min(n_components, n_ch)

    try:
        ica = FastICA(
            n_components=n_components,
            random_state=42,
            whiten='unit-variance',
            max_iter=1000,
            tol=1e-4,
        )
        S = ica.fit_transform(X)
    except Exception:
        return x_ch_t

    keep = np.ones((S.shape[1],), dtype=bool)
    for k in range(S.shape[1]):
        s = S[:, k]
        s = (s - float(s.mean())) / (float(s.std()) + 1e-6)
        r = float(np.corrcoef(s, eog_ref)[0, 1])
        if np.isfinite(r) and abs(r) >= float(corr_threshold):
            keep[k] = False

    if keep.all():
        return x_ch_t

    S_clean = S.copy()
    S_clean[:, ~keep] = 0.0
    try:
        X_clean = np.dot(S_clean, ica.mixing_.T) + ica.mean_
    except Exception:
        return x_ch_t
    return X_clean.T.astype(np.float32)


def extract_features_from_file(file_path: str) -> Dict[str, Any]:
    """End-to-end feature extraction from one EEG CSV file.

    Output includes:
    - td_feats: basic time-domain statistics per channel
    - bp_feats: bandpower per (band, channel)
    - spec_img: log10(mean over channels of spectrogram) as 2D array
    This is the authoritative feature function used by both training and API.
    """
    df_raw = pd.read_csv(file_path)
    df_raw['source_file'] = os.path.basename(file_path)
    df_long = normalize_long_df(df_raw)

    trial_number = int(df_long['trial_number'].iloc[0])
    label = int(df_long['label'].iloc[0])
    source_file = str(df_long['source_file'].iloc[0])

    x_ch_t, ch_names = build_epoch_matrix_from_long(df_long, trial_number=trial_number)
    if EOG_CLEAN:
        x_ch_t = eog_clean_epoch_matrix(x_ch_t, ch_names, fs=FS)

    td_mean = x_ch_t.mean(axis=1)
    td_std = x_ch_t.std(axis=1)
    td_min = x_ch_t.min(axis=1)
    td_max = x_ch_t.max(axis=1)

    td_feats = []
    td_cols = []
    for ci, ch in enumerate(ch_names):
        td_feats.extend([td_mean[ci], td_std[ci], td_min[ci], td_max[ci]])
        td_cols.extend([
            f'td_mean_{ch}',
            f'td_std_{ch}',
            f'td_min_{ch}',
            f'td_max_{ch}',
        ])
    td_feats = np.asarray(td_feats, dtype=np.float32)

    freqs, psd = welch_psd_features(x_ch_t, fs=FS, nperseg=128)
    bp_feats = []
    bp_cols = []
    for bname, brange in BANDS.items():
        bp = bandpower(psd, freqs, brange)
        for ci, ch in enumerate(ch_names):
            bp_feats.append(bp[ci])
            bp_cols.append(f'bp_{bname}_{ch}')

    bp_feats = np.asarray(bp_feats, dtype=np.float32)

    f, t, s = spectrogram_tf(x_ch_t, fs=FS, nperseg=64, noverlap=48, nfft=256, fmax=45)
    s_img = np.log10(s.mean(axis=0) + 1e-12).astype(np.float32)

    return {
        'source_file': source_file,
        'trial_number': trial_number,
        'label': label,
        'td_feats': td_feats,
        'td_cols': td_cols,
        'bp_feats': bp_feats,
        'bp_cols': bp_cols,
        'spec_img': s_img,
        'spec_f': f,
        'spec_t': t,
        'ch_names': ch_names,
    }
