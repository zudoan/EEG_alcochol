from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
from sklearn.ensemble import RandomForestClassifier
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


def train_models_nguyenhuutuanphat(X_train, y_train, X_test, y_test, random_state=42, cv_splits=None, verbose=None) -> Dict[str, Dict[str, Any]]:
    results: Dict[str, Dict[str, Any]] = {}

    cv_splits = GRIDSEARCH_CV_SPLITS if cv_splits is None else int(cv_splits)
    verbose = 0 if verbose is None else int(verbose)

    base = RandomForestClassifier(random_state=random_state, n_jobs=-1)
    best, gs = _grid_search_cv_auc(
        base,
        {
            'n_estimators': [200, 400],
            'max_depth': [None, 10, 20],
            'min_samples_split': [2, 5],
        },
        X_train,
        y_train,
        cv_splits=cv_splits,
        random_state=random_state,
        verbose=verbose,
        tag='NguyenHuuTuanPhat/RF',
    )

    y_pred = best.predict(X_test)
    y_prob = best.predict_proba(X_test)[:, 1]

    results['NguyenHuuTuanPhat - Random Forest (Bandpower)'] = {
        'y_pred': y_pred,
        'y_prob': y_prob,
        'model_obj': best,
        'meta': {'type': 'sklearn', 'gridsearch': gs},
    }

    return results


def train_cnn_spectrogram_grid(X_spec_train, y_train, X_spec_test, y_test, random_state=42, verbose=None) -> Optional[Dict[str, Any]]:
    try:
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers

        tf.random.set_seed(random_state)

        Xtr = np.asarray(X_spec_train, dtype=np.float32)
        Xte = np.asarray(X_spec_test, dtype=np.float32)

        # Pipeline builds X_spec as (N, F, T, 1). Normalize on the 2D image then add channel back.
        if Xtr.ndim == 4 and Xtr.shape[-1] == 1:
            Xtr2 = Xtr[..., 0]
        else:
            Xtr2 = Xtr
        if Xte.ndim == 4 and Xte.shape[-1] == 1:
            Xte2 = Xte[..., 0]
        else:
            Xte2 = Xte

        mu = float(Xtr2.mean())
        sd = float(Xtr2.std())
        Xtr_n = (Xtr2 - mu) / (sd + 1e-6)
        Xte_n = (Xte2 - mu) / (sd + 1e-6)

        Xtr_n = Xtr_n[..., None]
        Xte_n = Xte_n[..., None]

        grid = [
            {'lr': 1e-3, 'dropout': 0.35, 'filters1': 32, 'filters2': 64, 'dense': 128},
            {'lr': 5e-4, 'dropout': 0.45, 'filters1': 32, 'filters2': 64, 'dense': 128},
        ]

        verbose = 0 if verbose is None else int(verbose)
        fit_verbose = 1 if verbose else 0

        best_auc = -np.inf
        best_cfg = None
        best_model = None

        for gi, cfg in enumerate(grid, start=1):
            if verbose:
                print(f'[NguyenHuuTuanPhat/CNN] {gi}/{len(grid)} cfg={cfg}')
            model = keras.Sequential([
                layers.Input(shape=Xtr_n.shape[1:]),
                layers.Conv2D(cfg['filters1'], (3, 3), padding='same', use_bias=False),
                layers.BatchNormalization(),
                layers.Activation('relu'),
                layers.MaxPool2D((2, 2)),
                layers.Dropout(cfg['dropout']),
                layers.Conv2D(cfg['filters2'], (3, 3), padding='same', use_bias=False),
                layers.BatchNormalization(),
                layers.Activation('relu'),
                layers.MaxPool2D((2, 2)),
                layers.Dropout(cfg['dropout']),
                layers.Flatten(),
                layers.Dense(cfg['dense'], activation='relu'),
                layers.Dropout(cfg['dropout']),
                layers.Dense(1, activation='sigmoid'),
            ])

            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=cfg['lr']),
                loss='binary_crossentropy',
                metrics=[keras.metrics.AUC(name='auc'), keras.metrics.BinaryAccuracy(name='acc')],
            )

            cb = [keras.callbacks.EarlyStopping(monitor='val_auc', mode='max', patience=6, restore_best_weights=True)]

            model.fit(
                Xtr_n,
                y_train,
                validation_data=(Xte_n, y_test),
                epochs=40,
                batch_size=16,
                callbacks=cb,
                verbose=fit_verbose,
            )

            y_prob = model.predict(Xte_n, verbose=0).ravel()
            try:
                from sklearn.metrics import roc_auc_score

                auc = float(roc_auc_score(y_test, y_prob))
            except Exception:
                auc = float('nan')

            if auc > best_auc:
                best_auc = auc
                best_cfg = cfg
                best_model = model

                if verbose:
                    print(f'[NguyenHuuTuanPhat/CNN] best_auc_val={best_auc} best_cfg={best_cfg}')

        if best_model is None:
            return None

        y_prob = best_model.predict(Xte_n, verbose=0).ravel()
        y_pred = (y_prob >= 0.5).astype(int)

        return {
            'y_pred': y_pred,
            'y_prob': y_prob,
            'model_obj': best_model,
            'meta': {'type': 'keras', 'norm': 'zscore_train', 'gridsearch': {'grid': grid, 'best_cfg': best_cfg, 'best_auc_val': float(best_auc)}},
        }

    except Exception:
        return None


def train_crnn_spectrogram_grid(X_spec_train, y_train, X_spec_test, y_test, random_state=42, verbose=None) -> Optional[Dict[str, Any]]:
    verbose0 = 0 if verbose is None else int(verbose)
    try:
        import tensorflow as tf
        from tensorflow import keras
        from tensorflow.keras import layers

        tf.random.set_seed(random_state)

        Xtr = np.asarray(X_spec_train, dtype=np.float32)
        Xte = np.asarray(X_spec_test, dtype=np.float32)

        if Xtr.ndim == 4 and Xtr.shape[-1] == 1:
            Xtr2 = Xtr[..., 0]
        else:
            Xtr2 = Xtr
        if Xte.ndim == 4 and Xte.shape[-1] == 1:
            Xte2 = Xte[..., 0]
        else:
            Xte2 = Xte

        mu = float(Xtr2.mean())
        sd = float(Xtr2.std())
        Xtr_n = (Xtr2 - mu) / (sd + 1e-6)
        Xte_n = (Xte2 - mu) / (sd + 1e-6)

        Xtr_in = Xtr_n[..., None]
        Xte_in = Xte_n[..., None]

        fit_verbose = 1 if verbose0 else 0

        grid = [
            {'lr': 1e-3, 'dropout': 0.35, 'filters': 48, 'lstm': 96, 'dense': 64},
            {'lr': 5e-4, 'dropout': 0.45, 'filters': 64, 'lstm': 96, 'dense': 64},
        ]

        best_auc = -np.inf
        best_cfg = None
        best_model = None

        for gi, cfg in enumerate(grid, start=1):
            if verbose0:
                print(f'[NguyenHuuTuanPhat/CRNN] {gi}/{len(grid)} cfg={cfg}')

            inp = keras.Input(shape=Xtr_in.shape[1:])
            x = layers.Conv2D(cfg['filters'], (3, 3), padding='same', use_bias=False)(inp)
            x = layers.BatchNormalization()(x)
            x = layers.Activation('relu')(x)
            x = layers.MaxPool2D((2, 2))(x)
            x = layers.Dropout(cfg['dropout'])(x)

            x = layers.Conv2D(cfg['filters'], (3, 3), padding='same', use_bias=False)(x)
            x = layers.BatchNormalization()(x)
            x = layers.Activation('relu')(x)
            x = layers.MaxPool2D((2, 2))(x)
            x = layers.Dropout(cfg['dropout'])(x)

            shp = x.shape
            tdim = int(shp[2]) if shp[2] is not None else None
            fdim = int(shp[1]) if shp[1] is not None else None
            cdim = int(shp[3]) if shp[3] is not None else None

            if tdim is None or fdim is None or cdim is None:
                x = layers.Reshape((-1, 1))(x)
            else:
                x = layers.Permute((2, 1, 3))(x)
                x = layers.Reshape((tdim, fdim * cdim))(x)

            x = layers.Bidirectional(layers.LSTM(cfg['lstm'], return_sequences=False))(x)
            x = layers.Dropout(cfg['dropout'])(x)
            x = layers.Dense(cfg['dense'], activation='relu')(x)
            x = layers.Dropout(cfg['dropout'])(x)
            out = layers.Dense(1, activation='sigmoid')(x)
            model = keras.Model(inp, out)

            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=cfg['lr']),
                loss='binary_crossentropy',
                metrics=[keras.metrics.AUC(name='auc'), keras.metrics.BinaryAccuracy(name='acc')],
            )

            cb = [keras.callbacks.EarlyStopping(monitor='val_auc', mode='max', patience=7, restore_best_weights=True)]

            model.fit(
                Xtr_in,
                y_train,
                validation_data=(Xte_in, y_test),
                epochs=60,
                batch_size=16,
                callbacks=cb,
                verbose=fit_verbose,
            )

            y_prob = model.predict(Xte_in, verbose=0).ravel()
            try:
                from sklearn.metrics import roc_auc_score

                auc = float(roc_auc_score(y_test, y_prob))
            except Exception:
                auc = float('nan')

            if auc > best_auc:
                best_auc = auc
                best_cfg = cfg
                best_model = model

                if verbose0:
                    print(f'[NguyenHuuTuanPhat/CRNN] best_auc_val={best_auc} best_cfg={best_cfg}')

        if best_model is None:
            return None

        y_prob = best_model.predict(Xte_in, verbose=0).ravel()
        y_pred = (y_prob >= 0.5).astype(int)

        return {
            'y_pred': y_pred,
            'y_prob': y_prob,
            'model_obj': best_model,
            'meta': {'type': 'keras', 'norm': 'zscore_train', 'arch': 'crnn', 'gridsearch': {'grid': grid, 'best_cfg': best_cfg, 'best_auc_val': float(best_auc)}},
        }

    except Exception as e:
        if verbose0:
            print('[NguyenHuuTuanPhat/CRNN] failed:', repr(e))
        return None
