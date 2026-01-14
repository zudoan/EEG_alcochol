import os
from typing import Optional, Dict, Any

import numpy as np

from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    confusion_matrix,
    accuracy_score,
)


def evaluate_binary(name, y_true, y_pred, y_prob=None):
    """Compute standard binary classification metrics.

    Returns a JSON-serializable dict for logging and for the web dashboard.
    """
    y_true = np.asarray(y_true).astype(int)
    y_pred = np.asarray(y_pred).astype(int)

    acc = float(accuracy_score(y_true, y_pred))
    auc = None
    if y_prob is not None:
        y_prob = np.asarray(y_prob).astype(float)
        auc = float(roc_auc_score(y_true, y_prob))

    rep = classification_report(y_true, y_pred, output_dict=True)
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist()

    return {
        'name': name,
        'accuracy': acc,
        'roc_auc': auc,
        'report': rep,
        'confusion_matrix': cm,
    }


def safe_filename(name: str) -> str:
    bad = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    s = name
    for b in bad:
        s = s.replace(b, '_')
    return s


def export_models(results: Dict[str, Any], save_dir: str, scaler_bp=None):
    """Export trained models (joblib/keras) and optional bandpower scaler.

    Output files are written under saved_models/ so FastAPI can load them.
    """
    os.makedirs(save_dir, exist_ok=True)

    saved_paths = {}

    try:
        import joblib
        if scaler_bp is not None:
            p = os.path.join(save_dir, 'scaler_bp.joblib')
            joblib.dump(scaler_bp, p)
            saved_paths['scaler_bp'] = p
    except Exception:
        pass

    def _save_one(name, model_obj, meta=None):
        if model_obj is None:
            return None
        meta = meta or {}
        base = safe_filename(name)

        # keras
        if hasattr(model_obj, 'save') and meta.get('type') == 'keras':
            out_path = os.path.join(save_dir, f'{base}.keras')
            model_obj.save(out_path)
            return out_path

        # torch
        if meta.get('type') == 'torch':
            try:
                import torch

                out_path = os.path.join(save_dir, f'{base}.pt')
                torch.save({'state_dict': model_obj.state_dict(), 'meta': meta}, out_path)
                return out_path
            except Exception:
                return None

        import joblib
        out_path = os.path.join(save_dir, f'{base}.joblib')
        joblib.dump(model_obj, out_path)
        return out_path

    for name, info in results.items():
        saved_paths[name] = _save_one(name, info.get('model_obj'), meta=info.get('meta'))

    return saved_paths
