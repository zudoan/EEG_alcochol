import os
from typing import List

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from .config import FS, BANDS, EOG_CLEAN
from .preprocessing import normalize_long_df, build_epoch_matrix_from_long, welch_psd_features, bandpower, eog_clean_epoch_matrix


def quick_label(fp: str) -> int:
    df0 = pd.read_csv(fp, nrows=5)
    y = df0['subject identifier'].iloc[0]
    return 1 if y == 'a' else 0


def label_summary(train_files: List[str], test_files: List[str]):
    train_labels = np.array([quick_label(fp) for fp in train_files], dtype=int)
    test_labels = np.array([quick_label(fp) for fp in test_files], dtype=int)
    return {
        'train_counts': np.bincount(train_labels),
        'test_counts': np.bincount(test_labels),
    }


def plot_psd_and_bandpower(sample_fp: str):
    df_raw = pd.read_csv(sample_fp)
    df_raw['source_file'] = os.path.basename(sample_fp)
    df_long = normalize_long_df(df_raw)
    trial_number = int(df_long['trial_number'].iloc[0])

    x_ch_t, ch_names = build_epoch_matrix_from_long(df_long, trial_number=trial_number)
    if EOG_CLEAN:
        x_ch_t = eog_clean_epoch_matrix(x_ch_t, ch_names, fs=FS)
    freqs, psd = welch_psd_features(x_ch_t, fs=FS, nperseg=128)

    plt.figure(figsize=(12, 4))
    for i in range(min(5, psd.shape[0])):
        plt.semilogy(freqs, psd[i], label=ch_names[i], linewidth=1)
    plt.xlim(0, 45)
    plt.title('Welch PSD (một vài kênh) - file mẫu')
    plt.xlabel('Frequency (Hz)')
    plt.ylabel('PSD (log scale)')
    plt.grid(alpha=0.2)
    plt.legend(ncol=5, fontsize=8)
    plt.tight_layout()
    plt.show()

    bp_rows = []
    for bname, brange in BANDS.items():
        bp = bandpower(psd, freqs, brange)
        bp_rows.append({'band': bname, 'mean_bp': float(bp.mean())})
    bp_df = pd.DataFrame(bp_rows)

    plt.figure(figsize=(7, 3.5))
    plt.bar(bp_df['band'], bp_df['mean_bp'])
    plt.title('Bandpower (mean over channels)')
    plt.ylabel('Bandpower')
    plt.grid(axis='y', alpha=0.2)
    plt.tight_layout()
    plt.show()

    return bp_df
