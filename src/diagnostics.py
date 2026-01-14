import os
from typing import Dict, Any

import numpy as np
import pandas as pd

from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

try:
    from scipy.stats import ks_2samp
except Exception:
    ks_2samp = None

from .feature_engineering import file_md5


def build_file_index(file_paths):
    rows = []
    for fp in file_paths:
        rows.append({
            'path': fp,
            'basename': os.path.basename(fp),
            'size': os.path.getsize(fp),
            'md5': file_md5(fp),
        })
    return pd.DataFrame(rows)


def leakage_diagnostics(train_files, test_files):
    train_index = build_file_index(train_files)
    test_index = build_file_index(test_files)

    basename_overlap = set(train_index['basename']).intersection(set(test_index['basename']))
    md5_overlap = set(train_index['md5']).intersection(set(test_index['md5']))

    return {
        'train_n': len(train_index),
        'test_n': len(test_index),
        'basename_overlap_count': len(basename_overlap),
        'md5_overlap_count': len(md5_overlap),
        'md5_overlap_values': sorted(list(md5_overlap)),
    }


def distribution_shift_diagnostics(X_bp_train, X_bp_test, bp_cols_ref=None, k=12) -> Dict[str, Any]:
    mu_tr = X_bp_train.mean(axis=0)
    mu_te = X_bp_test.mean(axis=0)
    d = np.abs(mu_tr - mu_te)
    idx = np.argsort(d)[::-1][:k]

    top = []
    for j in idx:
        top.append({
            'feature': bp_cols_ref[j] if bp_cols_ref is not None else f'f{j}',
            'abs_mean_diff': float(d[j]),
            'train_mean': float(mu_tr[j]),
            'test_mean': float(mu_te[j]),
            'train_std': float(X_bp_train[:, j].std()),
            'test_std': float(X_bp_test[:, j].std()),
        })

    ks = None
    if ks_2samp is not None:
        pvals = []
        for j in range(X_bp_train.shape[1]):
            try:
                p = ks_2samp(X_bp_train[:, j], X_bp_test[:, j]).pvalue
            except Exception:
                p = 1.0
            pvals.append(p)
        pvals = np.asarray(pvals)
        ks = {
            'alpha': 0.01,
            'sig_count': int((pvals < 0.01).sum()),
            'pvals': pvals,
        }

    # PCA 2D embedding to inspect (returned as arrays for downstream plotting)
    scaler = StandardScaler()
    X_all = np.vstack([X_bp_train, X_bp_test])
    X_all_s = scaler.fit_transform(X_all)
    Z = PCA(n_components=2, random_state=42).fit_transform(X_all_s)

    return {
        'top_mean_shift': top,
        'ks': ks,
        'pca_Z': Z,
    }


def data_quality_checks(X: np.ndarray, feature_names=None) -> Dict[str, Any]:
    X = np.asarray(X)
    out = {
        'shape': tuple(X.shape),
        'nan_count': int(np.isnan(X).sum()),
        'inf_count': int(np.isinf(X).sum()),
    }

    if X.ndim == 2:
        var = X.var(axis=0)
        out['constant_count'] = int((var <= 1e-12).sum())

        df = pd.DataFrame(X)
        sk = df.skew(axis=0, skipna=True).values
        out['skew_abs_top_idx'] = np.argsort(np.abs(sk))[::-1][:12].tolist()

        q1 = np.nanpercentile(X, 25, axis=0)
        q3 = np.nanpercentile(X, 75, axis=0)
        iqr = q3 - q1
        lo = q1 - 3.0 * iqr
        hi = q3 + 3.0 * iqr
        out_iqr = np.nanmean((X < lo) | (X > hi), axis=0)
        out['iqr_outlier_top_idx'] = np.argsort(out_iqr)[::-1][:12].tolist()

        mu = np.nanmean(X, axis=0)
        sd = np.nanstd(X, axis=0) + 1e-12
        z = (X - mu) / sd
        out_z = np.nanmean(np.abs(z) > 5.0, axis=0)
        out['z_outlier_top_idx'] = np.argsort(out_z)[::-1][:12].tolist()

        if feature_names is not None:
            out['skew_abs_top_features'] = [feature_names[i] for i in out['skew_abs_top_idx']]
            out['iqr_outlier_top_features'] = [feature_names[i] for i in out['iqr_outlier_top_idx']]
            out['z_outlier_top_features'] = [feature_names[i] for i in out['z_outlier_top_idx']]

    return out
