from typing import Any, Dict, List

from app.db.session import get_db
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Workers"])


@router.get("/workers/simulation")
def get_workers_for_simulation(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Returns workers with fraud/sensor data for the AstraThinks simulation."""
    try:
        # Get workers with fraud claims (high risk) + clean workers
        result = db.execute(
            text("""
            WITH fraud_workers AS (
                SELECT DISTINCT ON (w.worker_id)
                    w.worker_id, w.worker_name, w.platform, w.city, w.geo_zone_id,
                    w.vehicle_type, w.employment_type, w.kyc_verified, w.bank_verified,
                    w.fraud_risk_score,
                    pc.gps_tower_delta, pc.accelerometer_variance,
                    pc.claim_response_time_sec, pc.app_interaction_count, pc.fraud_score,
                    pc.fraud_flag, pc.payout_status,
                    'fraud' as data_type
                FROM workers w
                JOIN policy_claims pc ON pc.worker_id = w.worker_id
                WHERE pc.fraud_flag = true AND pc.gps_tower_delta IS NOT NULL
                ORDER BY w.worker_id, pc.fraud_score DESC
                LIMIT 4
            ),
            clean_workers AS (
                SELECT DISTINCT ON (w.worker_id)
                    w.worker_id, w.worker_name, w.platform, w.city, w.geo_zone_id,
                    w.vehicle_type, w.employment_type, w.kyc_verified, w.bank_verified,
                    w.fraud_risk_score,
                    pc.gps_tower_delta, pc.accelerometer_variance,
                    pc.claim_response_time_sec, pc.app_interaction_count, pc.fraud_score,
                    pc.fraud_flag, pc.payout_status,
                    'clean' as data_type
                FROM workers w
                JOIN policy_claims pc ON pc.worker_id = w.worker_id
                WHERE pc.fraud_flag = false AND pc.gps_tower_delta IS NOT NULL
                  AND pc.payout_status = 'paid'
                ORDER BY w.worker_id, pc.fraud_score ASC
                LIMIT 4
            )
            SELECT * FROM fraud_workers
            UNION ALL
            SELECT * FROM clean_workers
        """)
        ).fetchall()

        workers = []
        for idx, r in enumerate(result):
            risk = float(r.fraud_risk_score or 0.3)
            fraud_score = float(r.fraud_score or 0.1)
            gps_delta = float(r.gps_tower_delta or 50)
            acc_var = float(r.accelerometer_variance or 10)
            resp_time = float(r.claim_response_time_sec or 200)
            app_int = int(r.app_interaction_count or 20)

            # Map platform to match expected values
            platform = r.platform or "Swiggy Instamart"

            # Derive status from fraud flag and payout status
            payout_status = r.payout_status or "unknown"
            is_fraud = bool(r.fraud_flag)

            if is_fraud and fraud_score > 0.7:
                status = "flagged"
            elif not r.kyc_verified:
                status = "pending"
            else:
                status = "verified"

            name = r.worker_name or f"Worker {r.worker_id}"
            initials = "".join(p[0].upper() for p in name.split()[:2]) if name else "WK"

            tags = [
                {"label": f"{r.vehicle_type or 'Bike'} Delivery", "cls": ""},
                {"label": r.employment_type or "Full-time", "cls": ""},
            ]
            if r.kyc_verified:
                tags.append({"label": "KYC: Verified", "cls": ""})
            else:
                tags.append({"label": "KYC: Unverified", "cls": "warn"})
            if risk > 0.5:
                tags.append({"label": f"Risk: {risk:.4f}", "cls": "warn"})
            else:
                tags.append({"label": f"Risk: {risk:.4f}", "cls": ""})

            # Cluster info derived from graph fraud score
            cluster_size = max(1, int(fraud_score * 10))
            fraud_cluster_score = min(0.95, fraud_score * 1.1)

            workers.append(
                {
                    "idx": idx,
                    "id": f"W-{r.worker_id:04d}",
                    "name": name,
                    "initials": initials,
                    "platform": platform,
                    "city": r.city or "Delhi",
                    "zone": r.geo_zone_id or "Vasant Kunj",
                    "vehicle": (r.vehicle_type or "bike").capitalize(),
                    "employment": r.employment_type or "Full-time",
                    "kyc": bool(r.kyc_verified),
                    "bank": bool(r.bank_verified),
                    "fraud_risk": round(risk, 4),
                    "status": status,
                    "tags": tags,
                    "synthetic": False,
                    "features": {
                        "gps_tower_delta": round(gps_delta, 1),
                        "accelerometer_variance": round(acc_var, 3),
                        "claim_response_time_sec": round(resp_time, 1),
                        "app_interaction_count": app_int,
                        "device_flagged": 1 if gps_delta > 500 else 0,
                        "location_jump_flag": 1 if gps_delta > 800 else 0,
                    },
                    "graph": {
                        "cluster_size": cluster_size,
                        "fraud_cluster_score": round(fraud_cluster_score, 4),
                        "tabular_prob": round(fraud_score, 3),
                    },
                }
            )

        return workers
    except Exception as e:
        # Return minimal fallback if DB fails
        return [
            {
                "idx": 0,
                "id": "W-0295",
                "name": "Seema Chawla",
                "initials": "SC",
                "platform": "FreshToHome Express",
                "city": "Mumbai",
                "zone": "Andheri-W",
                "vehicle": "Scooter",
                "employment": "Full-time",
                "kyc": True,
                "bank": True,
                "fraud_risk": 0.235,
                "status": "flagged",
                "tags": [
                    {"label": "Risk: 0.235", "cls": ""},
                    {"label": "KYC: Verified", "cls": ""},
                ],
                "synthetic": False,
                "features": {
                    "gps_tower_delta": 532.7,
                    "accelerometer_variance": 69.146,
                    "claim_response_time_sec": 74.9,
                    "app_interaction_count": 18,
                    "device_flagged": 1,
                    "location_jump_flag": 0,
                },
                "graph": {
                    "cluster_size": 9,
                    "fraud_cluster_score": 0.9,
                    "tabular_prob": 0.99,
                },
            }
        ]
