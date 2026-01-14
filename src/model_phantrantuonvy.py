from __future__ import annotations

from typing import Any, Dict

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.base import clone
from sklearn.model_selection import ParameterGrid, StratifiedKFold

from .config import GRIDSEARCH_CV_SPLITS


def _binary_auc_score(y_true: np.ndarray, y_score: np.ndarray) -> float:
    try:
        from sklearn.metrics import roc_auc_score

        return float(roc_auc_score(y_true, y_score))
    except Exception:
        return float('nan')


def _get_model_scores(model: Any, X: np.ndarray):
    if hasattr(model, 'predict_proba'):
        try:
            p = model.predict_proba(X)
            if p is None:
                return None
            p = np.asarray(p)
            if p.ndim == 2 and p.shape[1] >= 2:
                return p[:, 1]
        except Exception:
            pass

    if hasattr(model, 'decision_function'):
        try:
            s = model.decision_function(X)
            if s is None:
                return None
            return np.asarray(s).reshape(-1)
        except Exception:
            pass

    return None


def _grid_search_cv_auc(estimator, param_grid, X, y, *, cv_splits=3, random_state=42, verbose=0, tag='GridSearch'):
    X = np.asarray(X)
    y = np.asarray(y).astype(int)

    cv = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=random_state)
    best_score = -np.inf
    best_params = {}
    best_cv_scores = None

    grid_list = list(ParameterGrid(param_grid))
    if verbose:
        print(f'[{tag}] combos={len(grid_list)} cv_splits={cv_splits}')

    for gi, params in enumerate(grid_list, start=1):
        if verbose:
            print(f'[{tag}] {gi}/{len(grid_list)} params={params}')
        scores = []
        for tr_idx, va_idx in cv.split(X, y):
            m = clone(estimator)
            m.set_params(**params)
            m.fit(X[tr_idx], y[tr_idx])
            y_score = _get_model_scores(m, X[va_idx])
            fold_auc = _binary_auc_score(y[va_idx], y_score) if y_score is not None else float('nan')
            scores.append(fold_auc)

            if verbose >= 2:
                print(f'[{tag}] fold_auc={fold_auc}')

        scores_arr = np.asarray(scores, dtype=float)
        score = float(np.nanmean(scores_arr))
        if score > best_score:
            best_score = score
            best_params = dict(params)
            best_cv_scores = scores_arr

            if verbose:
                print(f'[{tag}] best_auc_cv_mean={best_score} best_params={best_params}')

    best_est = clone(estimator)
    best_est.set_params(**best_params)
    best_est.fit(X, y)

    return best_est, {
        'best_auc_cv_mean': float(best_score),
        'best_params': best_params,
        'best_auc_cv_folds': None if best_cv_scores is None else [float(x) for x in best_cv_scores],
        'cv_splits': int(cv_splits),
    }


def train_models_phantrantuonvy(X_train, y_train, X_test, y_test, random_state=42, cv_splits=None, verbose=None) -> Dict[str, Dict[str, Any]]:
    results: Dict[str, Dict[str, Any]] = {}

    cv_splits = GRIDSEARCH_CV_SPLITS if cv_splits is None else int(cv_splits)
    verbose = 0 if verbose is None else int(verbose)

    base = LogisticRegression(random_state=random_state, max_iter=5000, solver='liblinear')
    best, gs = _grid_search_cv_auc(
        base,
        {
            'C': [0.1, 1.0, 10.0],
            'penalty': ['l1', 'l2'],
        },
        X_train,
        y_train,
        cv_splits=cv_splits,
        random_state=random_state,
        verbose=verbose,
        tag='PhanTranTuonVy/LR',
    )

    y_pred = best.predict(X_test)
    y_prob = best.predict_proba(X_test)[:, 1]

    results['PhanTranTuonVy - Logistic Regression (Bandpower)'] = {
        'y_pred': y_pred,
        'y_prob': y_prob,
        'model_obj': best,
        'meta': {'type': 'sklearn', 'gridsearch': gs},
    }

    return results
