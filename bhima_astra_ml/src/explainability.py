import os
import joblib
import numpy as np
import pandas as pd
import shap
import logging

logger = logging.getLogger("bhima.shap")


class BhimaExplainer:
    def __init__(self,
                 model_path="models/fraud_model.pkl",
                 features_path="models/fraud_features.pkl"):

        self.model = joblib.load(model_path) if os.path.exists(model_path) else None
        self.feature_names = joblib.load(features_path) if os.path.exists(features_path) else None

        if self.model:
            self.explainer = shap.TreeExplainer(self.model)
            logger.info("✅ SHAP Explainer loaded")
        else:
            self.explainer = None
            logger.warning("⚠️ SHAP model not found")

    def explain_single_claim(self, features_dict, top_k=3):

        if not self.explainer or not self.feature_names:
            return []

        row = pd.DataFrame([features_dict]).reindex(
            columns=self.feature_names, fill_value=0
        )

        row = row.select_dtypes(include=[np.number]).fillna(0)

        shap_values = self.explainer(row)

        if len(shap_values.values.shape) == 3:
            impacts = shap_values.values[0, :, 1]
        else:
            impacts = shap_values.values[0]

        feature_impacts = list(zip(self.feature_names, impacts))

        feature_impacts.sort(key=lambda x: abs(x[1]), reverse=True)

        result = []
        for feat, impact in feature_impacts[:top_k]:
            result.append({
                "feature": feat,
                "impact_log_odds": float(impact),
                "effect": "INCREASED" if impact > 0 else "DECREASED"
            })

        return result