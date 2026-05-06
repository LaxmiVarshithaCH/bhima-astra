"""
ML Model Loader - Load all trained models at startup

Handles loading and caching all 4 trained ML models:
- income_model.pkl (Random Forest)
- disruption_realtime_model.pkl (XGBoost Risk)
- premium_model.pkl (Ridge Regression)
- fraud_model.pkl (XGBoost Fraud Classifier)

Plus supporting encoders and feature specifications.
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import joblib

logger = logging.getLogger("bhima.ml.model_loader")

# Models cache - loaded at startup
_models_cache: Dict[str, Any] = {}
_encoders_cache: Dict[str, Any] = {}
_features_cache: Dict[str, Any] = {}

# Model paths
MODEL_DIR = os.getenv(
    "MODEL_DIR",
    "/Users/laxmivarshitha/Documents/Hackathons/GuideWireDevTrails/bhima_astra1/bhima_astra_ml/models",
)

MODEL_PATHS = {
    # Primary inference models
    "income_model": f"{MODEL_DIR}/income_model.pkl",
    "disruption_realtime_model": f"{MODEL_DIR}/disruption_realtime_model.pkl",
    "disruption_forecast_model": f"{MODEL_DIR}/disruption_forecast_model.pkl",
    # Behavioural/context-only disruption model (29 features, no same-day weather)
    "disruption_model": f"{MODEL_DIR}/disruption_model.pkl",
    "premium_model": f"{MODEL_DIR}/premium_model.pkl",
    "fraud_model": f"{MODEL_DIR}/fraud_model.pkl",
    # Static fraud-community graph (NetworkX, 400 worker nodes, 132 edges)
    "fraud_graph": f"{MODEL_DIR}/fraud_graph.pkl",
}

ENCODER_PATHS = {
    "workers_encoders": f"{MODEL_DIR}/workers_encoders.pkl",
    "daily_encoders": f"{MODEL_DIR}/daily_encoders.pkl",
    "claims_encoders": f"{MODEL_DIR}/claims_encoders.pkl",
}

FEATURE_PATHS = {
    "income_features": f"{MODEL_DIR}/income_features.pkl",
    "disruption_realtime_features": f"{MODEL_DIR}/disruption_realtime_features.pkl",
    "disruption_forecast_features": f"{MODEL_DIR}/disruption_forecast_features.pkl",
    # 29-feature behavioural disruption model feature list
    "disruption_features": f"{MODEL_DIR}/disruption_features.pkl",
    "fraud_features": f"{MODEL_DIR}/fraud_features.pkl",
    "premium_features": f"{MODEL_DIR}/premium_features.pkl",
}

THRESHOLD_PATHS = {
    # Disruption decision thresholds (optimal cut-points from training PR-curve)
    "disruption_realtime_threshold": f"{MODEL_DIR}/disruption_realtime_threshold.pkl",
    "disruption_forecast_threshold": f"{MODEL_DIR}/disruption_forecast_threshold.pkl",
    # Fraud adaptive-percentile calibration (5 631-sample distribution)
    "fraud_score_calibration": f"{MODEL_DIR}/fraud_score_calibration.pkl",
    # Fraud raw-probability threshold (scalar, 0.332)
    "fraud_threshold": f"{MODEL_DIR}/fraud_threshold.pkl",
    # Fraud training-set probability distribution (1 127 samples, fallback calibration)
    "fraud_prob_distribution": f"{MODEL_DIR}/fraud_prob_distribution.pkl",
}

SCALER_PATHS = {
    "premium_scaler": f"{MODEL_DIR}/premium_scaler.pkl",
}


# Scalers cache (separate from thresholds for clarity)
_scalers_cache: Dict[str, Any] = {}


def load_scaler(scaler_name: str) -> Optional[Any]:
    """Load a scaler (e.g. StandardScaler) from cache or disk."""
    if scaler_name in _scalers_cache:
        return _scalers_cache[scaler_name]

    if scaler_name not in SCALER_PATHS:
        logger.warning(f"Scaler {scaler_name} not found in SCALER_PATHS")
        return None

    scaler_path = SCALER_PATHS[scaler_name]
    if not Path(scaler_path).exists():
        logger.warning(f"Scaler file not found: {scaler_path}")
        return None

    try:
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            scaler = joblib.load(scaler_path)
        _scalers_cache[scaler_name] = scaler
        logger.info(f"✅ Loaded scaler: {scaler_name} from {scaler_path}")
        return scaler
    except Exception as e:
        logger.error(f"❌ Failed to load scaler {scaler_name}: {e}")
        return None


def get_scaler(scaler_name: str) -> Optional[Any]:
    """Get a scaler from cache (must be loaded via initialize_all_models first)."""
    return _scalers_cache.get(scaler_name)


def load_model(model_name: str) -> Optional[Any]:
    """Load a single model from cache or disk."""
    if model_name in _models_cache:
        return _models_cache[model_name]

    if model_name not in MODEL_PATHS:
        logger.warning(f"Model {model_name} not found in MODEL_PATHS")
        return None

    model_path = MODEL_PATHS[model_name]
    if not Path(model_path).exists():
        logger.warning(f"Model file not found: {model_path}")
        return None

    try:
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = joblib.load(model_path)
        _models_cache[model_name] = model
        logger.info(f"✅ Loaded model: {model_name} from {model_path}")
        return model
    except Exception as e:
        logger.error(f"❌ Failed to load model {model_name}: {e}")
        return None


def load_encoder(encoder_name: str) -> Optional[Any]:
    """Load an encoder from cache or disk."""
    if encoder_name in _encoders_cache:
        return _encoders_cache[encoder_name]

    if encoder_name not in ENCODER_PATHS:
        logger.warning(f"Encoder {encoder_name} not found in ENCODER_PATHS")
        return None

    encoder_path = ENCODER_PATHS[encoder_name]
    if not Path(encoder_path).exists():
        logger.warning(f"Encoder file not found: {encoder_path}")
        return None

    try:
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            encoder = joblib.load(encoder_path)
        _encoders_cache[encoder_name] = encoder
        logger.info(f"✅ Loaded encoder: {encoder_name}")
        return encoder
    except Exception as e:
        logger.error(f"❌ Failed to load encoder {encoder_name}: {e}")
        return None


def load_features(features_name: str) -> Optional[Any]:
    """Load feature specifications from cache or disk."""
    if features_name in _features_cache:
        return _features_cache[features_name]

    if features_name not in FEATURE_PATHS:
        logger.warning(f"Features {features_name} not found in FEATURE_PATHS")
        return None

    features_path = FEATURE_PATHS[features_name]
    if not Path(features_path).exists():
        logger.warning(f"Features file not found: {features_path}")
        return None

    try:
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            features = joblib.load(features_path)
        _features_cache[features_name] = features
        logger.info(f"✅ Loaded features: {features_name}")
        return features
    except Exception as e:
        logger.error(f"❌ Failed to load features {features_name}: {e}")
        return None


def load_threshold(threshold_name: str) -> Optional[Any]:
    """Load threshold/calibration data from cache or disk."""
    if threshold_name in _features_cache:
        return _features_cache[threshold_name]

    if threshold_name not in THRESHOLD_PATHS:
        logger.warning(f"Threshold {threshold_name} not found in THRESHOLD_PATHS")
        return None

    threshold_path = THRESHOLD_PATHS[threshold_name]
    if not Path(threshold_path).exists():
        logger.warning(f"Threshold file not found: {threshold_path}")
        return None

    try:
        import warnings

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            threshold = joblib.load(threshold_path)
        _features_cache[threshold_name] = threshold
        logger.info(f"✅ Loaded threshold: {threshold_name}")
        return threshold
    except Exception as e:
        logger.error(f"❌ Failed to load threshold {threshold_name}: {e}")
        return None


def initialize_all_models() -> bool:
    """
    Load all models, encoders, features, thresholds, and scalers at startup.

    Returns:
        bool: True if all critical models loaded successfully, False otherwise.
    """
    logger.info("🚀 Initializing all ML models...")

    loaded_count = 0
    failed_count = 0

    # Load models
    for model_name in MODEL_PATHS.keys():
        model = load_model(model_name)
        if model is not None:
            loaded_count += 1
        else:
            failed_count += 1

    # Load encoders
    for encoder_name in ENCODER_PATHS.keys():
        encoder = load_encoder(encoder_name)
        if encoder is not None:
            loaded_count += 1
        else:
            failed_count += 1

    # Load features
    for features_name in FEATURE_PATHS.keys():
        features = load_features(features_name)
        if features is not None:
            loaded_count += 1
        else:
            failed_count += 1

    # Load thresholds / calibration arrays
    for threshold_name in THRESHOLD_PATHS.keys():
        threshold = load_threshold(threshold_name)
        if threshold is not None:
            loaded_count += 1
        else:
            failed_count += 1

    # Load scalers
    for scaler_name in SCALER_PATHS.keys():
        scaler = load_scaler(scaler_name)
        if scaler is not None:
            loaded_count += 1
        else:
            failed_count += 1

    logger.info(
        f"📊 Model initialization complete: {loaded_count} loaded, {failed_count} failed"
    )

    # Only fail hard if the four primary inference models are missing
    critical = [
        "income_model",
        "disruption_realtime_model",
        "fraud_model",
        "premium_model",
    ]
    missing_critical = [m for m in critical if get_model(m) is None]
    if missing_critical:
        logger.error(f"❌ Critical models not loaded: {missing_critical}")
        return False

    return True


def get_model(model_name: str) -> Optional[Any]:
    """Get a model from cache (must be loaded via initialize_all_models first)."""
    return _models_cache.get(model_name)


def get_encoder(encoder_name: str) -> Optional[Any]:
    """Get an encoder from cache."""
    return _encoders_cache.get(encoder_name)


def get_features(features_name: str) -> Optional[Any]:
    """Get feature specifications from cache."""
    return _features_cache.get(features_name)


def get_threshold(threshold_name: str) -> Optional[Any]:
    """Get threshold data from cache."""
    return _features_cache.get(threshold_name)


def clear_cache():
    """Clear all cached models (useful for testing)."""
    global _models_cache, _encoders_cache, _features_cache, _scalers_cache
    _models_cache.clear()
    _encoders_cache.clear()
    _features_cache.clear()
    _scalers_cache.clear()
    logger.info("🧹 Model cache cleared")
