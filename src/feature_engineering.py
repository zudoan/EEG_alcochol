import hashlib
import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np

from .preprocessing import extract_features_from_file


def file_md5(path, chunk_size=1024 * 1024):
    """Compute MD5 hash for a file (used to detect identical content across datasets)."""
    h = hashlib.md5()
    with open(path, 'rb') as f:
        while True:
            b = f.read(chunk_size)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def filter_test_duplicates(train_paths, test_paths):
    """Remove test files that have identical content to any train file (data leakage guard)."""
    train_md5 = set(file_md5(p) for p in train_paths)
    keep = []
    dropped = []
    for p in test_paths:
        m = file_md5(p)
        if m in train_md5:
            dropped.append(p)
        else:
            keep.append(p)
    return keep, dropped


@dataclass
class DatasetBundle:
    X_td_train: np.ndarray
    X_bp_train: np.ndarray
    X_spec_train: np.ndarray
    y_train: np.ndarray
    groups_train: np.ndarray

    X_td_test: np.ndarray
    X_bp_test: np.ndarray
    X_spec_test: np.ndarray
    y_test: np.ndarray
    groups_test: np.ndarray

    td_cols_ref: List[str]
    bp_cols_ref: List[str]
    spec_f_ref: np.ndarray
    spec_t_ref: np.ndarray

    dropped_test: List[str]


def build_dataset_from_files(
    files_use,
    td_cols_ref=None,
    bp_cols_ref=None,
    spec_f_ref=None,
    spec_t_ref=None,
):
    """Build stacked feature matrices from a list of EEG files.

    The first successfully parsed file defines the reference schema:
    - td_cols_ref
    - bp_cols_ref
    - spectrogram (spec_f_ref, spec_t_ref) shape
    Files not matching the schema are skipped to keep matrix dimensions consistent.
    """
    X_td_list = []
    X_bp_list = []
    X_spec_list = []
    y_list = []
    groups_list = []

    skipped = 0
    for fp in files_use:
        out = extract_features_from_file(fp)

        if td_cols_ref is None:
            td_cols_ref = out['td_cols']
        elif out['td_cols'] != td_cols_ref:
            skipped += 1
            continue

        if bp_cols_ref is None:
            bp_cols_ref = out['bp_cols']
        elif out['bp_cols'] != bp_cols_ref:
            skipped += 1
            continue

        if spec_f_ref is None:
            spec_f_ref = out['spec_f']
            spec_t_ref = out['spec_t']
        else:
            if out['spec_img'].shape != (len(spec_f_ref), len(spec_t_ref)):
                skipped += 1
                continue

        X_td_list.append(out['td_feats'])
        X_bp_list.append(out['bp_feats'])
        X_spec_list.append(out['spec_img'])
        y_list.append(out['label'])
        groups_list.append(out['source_file'])

    X_td = np.stack(X_td_list, axis=0)
    X_bp = np.stack(X_bp_list, axis=0)
    X_spec = np.stack(X_spec_list, axis=0)[..., np.newaxis]
    y = np.asarray(y_list, dtype=np.int64)
    groups = np.asarray(groups_list)

    return X_td, X_bp, X_spec, y, groups, td_cols_ref, bp_cols_ref, spec_f_ref, spec_t_ref, skipped


def build_train_test_bundles(
    train_files: List[str],
    test_files: List[str],
    remove_test_duplicates: bool = True,
):
    """Build a train/test DatasetBundle, optionally removing test duplicates by MD5."""
    dropped_test = []
    test_use = test_files
    if remove_test_duplicates:
        test_use, dropped_test = filter_test_duplicates(train_files, test_files)

    X_td_train, X_bp_train, X_spec_train, y_train, groups_train, td_cols_ref, bp_cols_ref, spec_f_ref, spec_t_ref, _ = build_dataset_from_files(
        train_files,
        td_cols_ref=None,
        bp_cols_ref=None,
        spec_f_ref=None,
        spec_t_ref=None,
    )

    X_td_test, X_bp_test, X_spec_test, y_test, groups_test, td_cols_ref, bp_cols_ref, spec_f_ref, spec_t_ref, _ = build_dataset_from_files(
        test_use,
        td_cols_ref=td_cols_ref,
        bp_cols_ref=bp_cols_ref,
        spec_f_ref=spec_f_ref,
        spec_t_ref=spec_t_ref,
    )

    return DatasetBundle(
        X_td_train=X_td_train,
        X_bp_train=X_bp_train,
        X_spec_train=X_spec_train,
        y_train=y_train,
        groups_train=groups_train,
        X_td_test=X_td_test,
        X_bp_test=X_bp_test,
        X_spec_test=X_spec_test,
        y_test=y_test,
        groups_test=groups_test,
        td_cols_ref=td_cols_ref,
        bp_cols_ref=bp_cols_ref,
        spec_f_ref=spec_f_ref,
        spec_t_ref=spec_t_ref,
        dropped_test=dropped_test,
    )
