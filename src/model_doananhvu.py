from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
from sklearn.neural_network import MLPClassifier
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


def train_models_doananhvu(X_train, y_train, X_test, y_test, random_state=42, cv_splits=None, verbose=None) -> Dict[str, Dict[str, Any]]:
    results: Dict[str, Dict[str, Any]] = {}

    cv_splits = GRIDSEARCH_CV_SPLITS if cv_splits is None else int(cv_splits)
    verbose = 0 if verbose is None else int(verbose)

    # ANN (MLP)
    base_mlp = MLPClassifier(
        activation='relu',
        solver='adam',
        early_stopping=True,
        random_state=random_state,
    )
    best_mlp, gs_mlp = _grid_search_cv_auc(
        base_mlp,
        {
            'hidden_layer_sizes': [(128,), (256, 128)],
            'alpha': [1e-4, 1e-3],
            'max_iter': [350, 500],
        },
        X_train,
        y_train,
        cv_splits=cv_splits,
        random_state=random_state,
        verbose=verbose,
        tag='DoanAnhVu/MLP',
    )

    y_pred = best_mlp.predict(X_test)
    try:
        y_prob = best_mlp.predict_proba(X_test)[:, 1]
    except Exception:
        y_prob = None

    results['DoanAnhVu - ANN/MLP (Bandpower)'] = {
        'y_pred': y_pred,
        'y_prob': y_prob,
        'model_obj': best_mlp,
        'meta': {'type': 'sklearn', 'gridsearch': gs_mlp},
    }

    # XGBoost (optional)
    try:
        from xgboost import XGBClassifier

        base_xgb = XGBClassifier(
            random_state=random_state,
            eval_metric='logloss',
        )
        best_xgb, gs_xgb = _grid_search_cv_auc(
            base_xgb,
            {
                'n_estimators': [300, 500],
                'max_depth': [4, 6],
                'learning_rate': [0.05, 0.1],
                'subsample': [0.8, 1.0],
                'colsample_bytree': [0.8, 1.0],
            },
            X_train,
            y_train,
            cv_splits=cv_splits,
            random_state=random_state,
            verbose=verbose,
            tag='DoanAnhVu/XGB',
        )

        y_pred = best_xgb.predict(X_test)
        y_prob = best_xgb.predict_proba(X_test)[:, 1]

        results['DoanAnhVu - XGBoost (Bandpower)'] = {
            'y_pred': y_pred,
            'y_prob': y_prob,
            'model_obj': best_xgb,
            'meta': {'type': 'xgboost', 'gridsearch': gs_xgb},
        }

    except Exception:
        pass

    return results


def train_swin_spectrogram_tl(
    X_spec_train,
    y_train,
    X_spec_test,
    y_test,
    random_state=42,
    verbose=None,
) -> Optional[Dict[str, Any]]:
    verbose0 = 0 if verbose is None else int(verbose)
    try:
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, TensorDataset
        from transformers import SwinForImageClassification
        from transformers.optimization import get_cosine_schedule_with_warmup

        try:
            from sklearn.metrics import roc_auc_score
        except Exception:
            roc_auc_score = None

        torch.manual_seed(int(random_state))

        Xtr = np.asarray(X_spec_train, dtype=np.float32)
        Xte = np.asarray(X_spec_test, dtype=np.float32)

        # Pipeline builds X_spec as (N, F, T, 1). Use the 2D image for normalization and then build NCHW.
        if Xtr.ndim == 4 and Xtr.shape[-1] == 1:
            Xtr2 = Xtr[..., 0]
        else:
            Xtr2 = Xtr
        if Xte.ndim == 4 and Xte.shape[-1] == 1:
            Xte2 = Xte[..., 0]
        else:
            Xte2 = Xte

        vmin = float(Xtr2.min())
        vmax = float(Xtr2.max())
        Xtr01 = (Xtr2 - vmin) / (vmax - vmin + 1e-6)
        Xte01 = (Xte2 - vmin) / (vmax - vmin + 1e-6)

        Xtr_t = torch.from_numpy(Xtr01[:, None, :, :])
        Xte_t = torch.from_numpy(Xte01[:, None, :, :])

        Xtr_t = nn.functional.interpolate(Xtr_t, size=(224, 224), mode='bilinear', align_corners=False)
        Xte_t = nn.functional.interpolate(Xte_t, size=(224, 224), mode='bilinear', align_corners=False)
        Xtr_t = Xtr_t.repeat(1, 3, 1, 1)
        Xte_t = Xte_t.repeat(1, 3, 1, 1)

        # ImageNet normalization (to match pretrained Swin)
        mean = torch.tensor([0.485, 0.456, 0.406], dtype=torch.float32).view(1, 3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225], dtype=torch.float32).view(1, 3, 1, 1)
        Xtr_t = (Xtr_t - mean) / std
        Xte_t = (Xte_t - mean) / std

        ytr_t = torch.from_numpy(np.asarray(y_train, dtype=np.int64))
        yte_t = torch.from_numpy(np.asarray(y_test, dtype=np.int64))

        # IMPORTANT: do NOT early-stop on the test set. Create a validation split from train.
        try:
            from sklearn.model_selection import StratifiedShuffleSplit
        except Exception:
            StratifiedShuffleSplit = None

        ds_te = TensorDataset(Xte_t, yte_t)

        if StratifiedShuffleSplit is not None:
            ytr_np = np.asarray(y_train, dtype=int).reshape(-1)
            sss = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=int(random_state))
            tr_idx, va_idx = next(sss.split(np.zeros_like(ytr_np), ytr_np))
            ds_tr = TensorDataset(Xtr_t[tr_idx], ytr_t[tr_idx])
            ds_va = TensorDataset(Xtr_t[va_idx], ytr_t[va_idx])
        else:
            ds_tr = TensorDataset(Xtr_t, ytr_t)
            ds_va = TensorDataset(Xtr_t, ytr_t)

        bs = 8
        dl_tr = DataLoader(ds_tr, batch_size=bs, shuffle=True)
        dl_va = DataLoader(ds_va, batch_size=bs, shuffle=False)
        dl_te = DataLoader(ds_te, batch_size=bs, shuffle=False)

        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

        model_name = 'microsoft/swin-tiny-patch4-window7-224'
        model = SwinForImageClassification.from_pretrained(model_name, num_labels=2, ignore_mismatched_sizes=True)
        model.to(device)

        # Freeze most backbone, unfreeze progressively.
        for p in model.swin.parameters():
            p.requires_grad = False
        def _set_unfreeze_stage(stage: int):
            # stage=1: last encoder stage; stage=2: last 2 encoder stages
            try:
                layers = model.swin.encoder.layers
            except Exception:
                return

            n = len(layers)
            k = 1 if stage <= 1 else 2
            start = max(0, n - k)
            for li in range(start, n):
                for p in layers[li].parameters():
                    p.requires_grad = True

        _set_unfreeze_stage(stage=1)

        base_lr = 2e-4
        opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=base_lr, weight_decay=0.05)
        loss_fn = torch.nn.CrossEntropyLoss(label_smoothing=0.05)

        epochs = 20
        warmup_ratio = 0.1
        total_steps = max(1, int(np.ceil(len(ds_tr) / bs)) * epochs)
        warmup_steps = max(1, int(total_steps * warmup_ratio))
        sched = get_cosine_schedule_with_warmup(opt, num_warmup_steps=warmup_steps, num_training_steps=total_steps)

        best_auc = -1.0
        best_state = None
        patience = 5
        bad = 0

        for epoch in range(epochs):
            # Gradual unfreeze: after a few epochs, also unfreeze the 2nd-last stage.
            if epoch == 4:
                _set_unfreeze_stage(stage=2)
                opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=base_lr * 0.5, weight_decay=0.05)
                sched = get_cosine_schedule_with_warmup(opt, num_warmup_steps=warmup_steps, num_training_steps=total_steps)

            model.train()
            for xb, yb in dl_tr:
                xb = xb.to(device)
                yb = yb.to(device)
                opt.zero_grad(set_to_none=True)
                out = model(pixel_values=xb)
                loss = loss_fn(out.logits, yb)
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                opt.step()
                sched.step()

            model.eval()
            probs = []
            with torch.no_grad():
                for xb, _ in dl_va:
                    xb = xb.to(device)
                    out = model(pixel_values=xb)
                    p = torch.softmax(out.logits, dim=-1)[:, 1]
                    probs.append(p.detach().cpu())
            y_prob = torch.cat(probs, dim=0).numpy().reshape(-1)

            auc = None
            if roc_auc_score is not None:
                try:
                    auc = float(roc_auc_score(np.asarray([int(x[1].item()) for x in ds_va]).astype(int), y_prob))
                except Exception:
                    auc = None

            if verbose0:
                if auc is None:
                    print(f'[DoanAnhVu/Swin] epoch={epoch + 1} done')
                else:
                    print(f'[DoanAnhVu/Swin] epoch={epoch + 1} val_auc={auc:.4f}')

            if auc is None:
                continue
            if auc > best_auc + 1e-4:
                best_auc = auc
                best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
                bad = 0
            else:
                bad += 1
                if bad >= patience:
                    break

        if best_state is not None:
            model.load_state_dict(best_state, strict=False)

        model.eval()
        probs = []
        with torch.no_grad():
            for xb, _ in dl_te:
                xb = xb.to(device)
                out = model(pixel_values=xb)
                p = torch.softmax(out.logits, dim=-1)[:, 1]
                probs.append(p.detach().cpu())
        y_prob = torch.cat(probs, dim=0).numpy().reshape(-1)
        y_pred = (y_prob >= 0.5).astype(int)

        return {
            'y_pred': y_pred,
            'y_prob': y_prob,
            'model_obj': model,
            'meta': {
                'type': 'torch',
                'arch': 'swin',
                'model_name': model_name,
                'norm': 'minmax_train_01+imagenet',
                'image_size': [224, 224],
                'vmin': vmin,
                'vmax': vmax,
                'imagenet_mean': [0.485, 0.456, 0.406],
                'imagenet_std': [0.229, 0.224, 0.225],
                'unfreeze_last_stage': True,
                'scheduler': 'cosine_warmup',
                'epochs': int(epochs),
                'val_split': 0.2,
                'best_val_auc': float(best_auc),
            },
        }
    except Exception as e:
        if verbose0:
            print('[DoanAnhVu/Swin] failed:', repr(e))
        return None
