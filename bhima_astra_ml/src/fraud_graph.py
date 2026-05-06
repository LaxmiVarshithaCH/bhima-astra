"""
BHIMA ASTRA — Graph-Based Fraud Detection
Stage 2: Build graph  |  Stage 3: Cluster analysis
Stage 4: Final combined decision engine
"""

import pandas as pd
import numpy as np
import networkx as nx
import joblib
import os
from collections import defaultdict
from itertools import combinations


# ══════════════════════════════════════════════════════════
# STAGE 2 — GRAPH BUILDER
# ══════════════════════════════════════════════════════════

import math

# Maximum shared-attribute cluster sizes before link is ignored
# ✅ NEW
MAX_CLUSTER_SIZE = {
    "device_id": 10,   # device sharing up to 10 workers allowed
    "upi_id":    5,    # UPI sharing up to 5
    "bank_ifsc": 5,    # IFSC sharing up to 5
    # geo_zone_id REMOVED completely — creates meaningless bulk connections
}
MIN_EDGE_WEIGHT = 1.0  # prune edges weaker than this after building
MAX_EDGE_WEIGHT = 6.0

def fraud_graph_builder(workers_graph: pd.DataFrame) -> nx.Graph:
    """
    Uses workers_graph.csv (identity columns preserved).
    Applies cluster-size caps, log-normalized weights,
    and post-build edge pruning to prevent over-connection.
    """
    print("\n[Stage 2] Building fraud graph (filtered)...")

    # ── Load from graph dataset, NOT workers_clean ────────
    # workers_graph has: worker_id, device_id, upi_id,
    #                    bank_ifsc, geo_zone_id
    G = nx.Graph()

    # Add worker nodes
    for _, row in workers_graph.iterrows():
        wid = int(row["worker_id"])
        G.add_node(f"W{wid}", node_type="worker", worker_id=wid)

    # Base weights per attribute type
    BASE_WEIGHTS = {
        "device_id":   4.0,
        "upi_id":      3.5,
        "bank_ifsc":   2.0,
    }

    for attr, base_weight in BASE_WEIGHTS.items():
        if attr not in workers_graph.columns:
            continue

        max_allowed = MAX_CLUSTER_SIZE[attr]

        # Build lookup: attribute_value → list of worker_ids
        attr_map = defaultdict(list)
        for _, row in workers_graph.iterrows():
            val = str(row.get(attr, "")).strip()
            if val and val not in ("nan", "", "0", "None"):
                attr_map[val].append(int(row["worker_id"]))

        edges_added = 0
        for val, wids in attr_map.items():
            cluster_n = len(wids)

            # ── FILTER: skip if cluster too large ─────────
            # Large clusters = common attribute (e.g. popular IFSC)
            # Not suspicious — just a common bank branch
            if cluster_n > max_allowed:
                continue

            # ── WEIGHT: log-normalize to reduce cluster dominance
            # Edge weight = base / log(cluster_size + 1)
            # cluster_size=2 → weight = base/0.69 ≈ base×1.44
            # cluster_size=5 → weight = base/1.79 ≈ base×0.56
            # Larger clusters get lower per-edge weight
            normalized_weight = base_weight / math.log(cluster_n + 2)
            normalized_weight = min(normalized_weight, MAX_EDGE_WEIGHT)


            for w1, w2 in combinations(wids, 2):
                n1, n2 = f"W{w1}", f"W{w2}"
                if G.has_edge(n1, n2):
                    G[n1][n2]["weight"]      += normalized_weight
                    G[n1][n2]["shared_attrs"].append(attr)
                    G[n1][n2]["link_count"]  += 1
                else:
                    G.add_edge(
                        n1, n2,
                        weight       = normalized_weight,
                        shared_attrs = [attr],
                        link_count   = 1,
                        link_type    = attr,
                    )
                    edges_added += 1

    original_edges = list(G.edges(data=True))
    # ── PRUNE: remove weak edges ───────────────────────────
    # A single weak link (e.g. same zone only) is not fraud evidence
    weak_edges = [
        (u, v) for u, v, d in G.edges(data=True)
        if d["weight"] < MIN_EDGE_WEIGHT
    ]
    G.remove_edges_from(weak_edges)
    print(f"  Edges removed (weak < {MIN_EDGE_WEIGHT}): {len(weak_edges)}")

    if G.number_of_edges() == 0:
        print("⚠️  Graph too sparse — restoring relaxed edges (weight >= 0.5)")
        relaxed_edges = [
            (u, v, d) for u, v, d in original_edges
            if d["weight"] >= 0.5
        ]
        G.add_edges_from(relaxed_edges)
        print(f"  Restored {len(relaxed_edges)} edges from fallback")
    # ✅ ADD this immediately after loading workers_graph, before the node loop
    print("Unique identity counts:")
    print(workers_graph[["device_id", "upi_id", "bank_ifsc"]].nunique())
    print("Sample values:")
    print(workers_graph[["device_id", "upi_id", "bank_ifsc"]].head(5))
    print(f"  Nodes            : {G.number_of_nodes()}")
    print(f"  Edges (after prune): {G.number_of_edges()}")
    print(f"  Edges removed (weak): {len(weak_edges)}")
    high = [(u,v,d) for u,v,d in G.edges(data=True) if d["weight"] >= 5.0]
    print(f"  High-weight edges (≥5.0): {len(high)}")

    return G

import pandas as pd   # already imported — no duplicate needed

TIME_WINDOW_SECONDS = 45    # claims within 2 minutes = suspicious
TIME_EDGE_WEIGHT    = 1.5    # weight for timing-based edges


def add_time_window_edges(
    G: nx.Graph,
    claims_df: pd.DataFrame,
) -> nx.Graph:
    """
    Stage 3 upgrade: adds edges between workers who filed claims
    within TIME_WINDOW_SECONDS of each other.

    Coordinated fraud rings often file simultaneously
    (Telegram-orchestrated attacks fire within seconds).

    Args:
        G          : existing graph (identity edges already built)
        claims_df  : policy_claims.csv with claim_timestamp + worker_id

    Returns:
        G : graph with time-window edges added
    """
    if "claim_timestamp" not in claims_df.columns:
        print("  ⚠️  claim_timestamp missing — skipping time-window edges")
        return G

    if "worker_id" not in claims_df.columns:
        return G

    print("\n[Stage 3 — Time Window] Adding temporal edges...")

    # Include geo_zone_id to check location!
    if "geo_zone_id" not in claims_df.columns:
        print("  ⚠️  geo_zone_id missing — proceeding with time-only edges")
        df = claims_df[["worker_id", "claim_timestamp"]].copy()
        df["geo_zone_id"] = "UNKNOWN"
    else:
        df = claims_df[["worker_id", "claim_timestamp", "geo_zone_id"]].copy()

    df["claim_timestamp"] = pd.to_datetime(
        df["claim_timestamp"], errors="coerce")
    df = df.dropna(subset=["claim_timestamp"])
    df = df.sort_values("claim_timestamp").reset_index(drop=True)

    edges_added = 0
    MAX_TIME_CONNECTIONS = 5
    # Compare each claim with subsequent claims within time window
    for i in range(len(df)):
        connections = 0
        t_i  = df.loc[i, "claim_timestamp"]
        w_i  = int(df.loc[i, "worker_id"])
        n_i  = f"W{w_i}"

        for j in range(i + 1, len(df)):

            if connections >= MAX_TIME_CONNECTIONS:
                break
            t_j = df.loc[j, "claim_timestamp"]
            w_j = int(df.loc[j, "worker_id"])

            # Stop scanning once outside time window
            delta_sec = abs((t_j - t_i).total_seconds())
            if delta_sec > TIME_WINDOW_SECONDS:
                break

            # Check if they are in the same zone
            zone_i = df.loc[i, "geo_zone_id"]
            zone_j = df.loc[j, "geo_zone_id"]
            if zone_i != zone_j and zone_i != "UNKNOWN":
                continue  # Skip if different zones!

            # Skip self-loops
            if w_i == w_j:
                continue

            n_j = f"W{w_j}"

            # Only add if both nodes exist in graph
            if not G.has_node(n_i) or not G.has_node(n_j):
                continue

            if G.has_edge(n_i, n_j):
                G[n_i][n_j]["weight"]      += TIME_EDGE_WEIGHT
                G[n_i][n_j]["shared_attrs"].append("time_window")
                G[n_i][n_j]["link_count"]  += 1
            else:
                G.add_edge(
                    n_i, n_j,
                    weight       = TIME_EDGE_WEIGHT,
                    shared_attrs = ["time_window"],
                    link_count   = 1,
                    link_type    = "time_window",
                )
                edges_added += 1
                connections += 1
    print(f"  Time-window edges added: {edges_added}")
    return G


# ══════════════════════════════════════════════════════════
# STAGE 3 — CLUSTER ANALYSIS
# ══════════════════════════════════════════════════════════

def compute_cluster_scores(G: nx.Graph) -> pd.DataFrame:
    """
    For each connected component, compute:
      - cluster_size
      - avg_edge_weight
      - density
      - avg_fraud_risk
      - fraud_cluster_score
      - network_risk_flag
    Returns one row per WORKER node.
    """
    print("\n[Stage 3] Running cluster analysis...")

    components  = list(nx.connected_components(G))
    worker_rows = []

    for comp in components:
        # Only worker nodes
        worker_nodes = [n for n in comp if G.nodes[n].get("node_type")=="worker"]
        if not worker_nodes:
            continue

        subG = G.subgraph(comp)

        # Cluster-level stats
        cluster_size = len(worker_nodes)

        edges = list(subG.edges(data=True))
        avg_weight  = np.mean([d["weight"] for _,_,d in edges]) if edges else 0
        density     = nx.density(subG)

        risk_scores = [
            G.nodes[n].get("fraud_risk_score", 0)
            for n in worker_nodes
        ]
        avg_risk = np.mean(risk_scores)

        # Fraud cluster score formula
        # Higher weight + denser + higher member risk = more suspicious
        raw_score = (
            min(avg_weight / 8.0, 1.0) * 0.40 +
            min(density, 1.0)          * 0.30 +
            min(avg_risk, 1.0)         * 0.30
        )
        fraud_cluster_score = round(raw_score, 4)
        network_risk_flag = int(
            cluster_size >= 3 and fraud_cluster_score >= 0.40
        )

        for node in worker_nodes:
            node_data = G.nodes[node]
            # Node-level degree and neighbor risk
            degree        = G.degree(node)
            nbr_risks     = [
                G.nodes[nb].get("fraud_risk_score", 0)
                for nb in G.neighbors(node)
            ]
            avg_nbr_risk = np.mean(nbr_risks) if nbr_risks else 0

            # Node-specific score blends cluster + individual signals
            node_score = round(
                fraud_cluster_score   * 0.50 +
                min(degree / 10, 1.0) * 0.25 +
                avg_nbr_risk          * 0.25,
                4
            )

            worker_rows.append({
                "worker_id":           node_data.get("worker_id"),
                "cluster_size":        cluster_size,
                "avg_edge_weight":     round(avg_weight, 3),
                "cluster_density":     round(density, 4),
                "avg_cluster_risk":    round(avg_risk, 4),
                "fraud_cluster_score": fraud_cluster_score,
                "network_risk_flag":   network_risk_flag,
                "node_degree":         degree,
                "avg_neighbor_risk":   round(avg_nbr_risk, 4),
                "node_fraud_score":    node_score,
            })

    scores_df = pd.DataFrame(worker_rows).sort_values(
        "node_fraud_score", ascending=False)

    rings = scores_df[scores_df["network_risk_flag"]==1]
    print(f"  Components analysed  : {len(components)}")
    print(f"  Workers scored       : {len(scores_df)}")
    print(f"  Suspected fraud rings: {len(rings)}")

    if len(rings) > 0:
        print("\n  🚨 Top Suspected Rings:")
        cols = ["worker_id","cluster_size",
                "fraud_cluster_score","node_fraud_score"]
        print(rings[cols].head(10).to_string(index=False))

    return scores_df


# ══════════════════════════════════════════════════════════
# STAGE 4 — COMBINED DECISION ENGINE
# ══════════════════════════════════════════════════════════

def enhanced_fraud_check(
    tabular_prob:    float,
    worker_id:       int,
    graph_scores_df: pd.DataFrame,
    tabular_threshold: float = 0.40,
    features:        dict  = None,
) -> dict:
    """
    Combines XGBoost tabular score + graph cluster score
    into a final fraud decision.

    Decision logic:
    ┌──────────────────────────────────────────────────────┐
    │ tabular_prob > threshold  OR  cluster_size > 5       │
    │ → BLOCK                                              │
    │ borderline tabular + network_risk_flag = 1 → REVIEW  │
    │ cluster score > 0.45 alone → MONITOR                 │
    │ else → APPROVE                                       │
    └──────────────────────────────────────────────────────┘
    """
    # Pull graph signals for this worker
    wrow = graph_scores_df[graph_scores_df["worker_id"] == worker_id]
    if not wrow.empty:
        cluster_size        = int(wrow["cluster_size"].iloc[0])
        fraud_cluster_score = float(wrow["fraud_cluster_score"].iloc[0])
        network_risk_flag   = int(wrow["network_risk_flag"].iloc[0])
        node_fraud_score    = float(wrow["node_fraud_score"].iloc[0])
    else:
        cluster_size        = 1
        fraud_cluster_score = 0.0
        network_risk_flag   = 0
        node_fraud_score    = 0.0

    # Combined score (weighted average)
    combined_score = round(
        tabular_prob        * 0.65 +
        fraud_cluster_score * 0.35,
        4
    )

    # Fraud reason (multi-factor — no single signal)
    reasons = []
    if features:
        if features.get("gps_tower_delta", 0) > 600:
            reasons.append("gps_mismatch")
        if features.get("accelerometer_variance", 99) < 1.0:
            reasons.append("device_anomaly")
        if features.get("claim_response_time_sec", 999) < 45:
            reasons.append("abnormal_behavior")
    if network_risk_flag == 1:
        reasons.append("ring_cluster")
    if not reasons:
        reasons.append("normal" if combined_score < tabular_threshold else "multi_factor")

    # Final decision
    if tabular_prob > tabular_threshold or cluster_size > 5:
        action    = "BLOCK"
        fraud_flag= 1
    elif (0.30 <= tabular_prob <= tabular_threshold and
          network_risk_flag == 1):
        action    = "REVIEW"
        fraud_flag= 1
    elif fraud_cluster_score > 0.45:
        action    = "MONITOR"
        fraud_flag= 0
    else:
        action    = "APPROVE"
        fraud_flag= 0

    return {
        "worker_id":           worker_id,
        "tabular_fraud_prob":  round(tabular_prob, 4),
        "fraud_cluster_score": fraud_cluster_score,
        "combined_score":      combined_score,
        "cluster_size":        cluster_size,
        "network_risk_flag":   network_risk_flag,
        "fraud_flag":          fraud_flag,
        "fraud_reason":        reasons[0] if reasons else "normal",
        "all_reasons":         reasons,
        "action":              action,
    }


# ══════════════════════════════════════════════════════════
# MAIN RUNNER
# ══════════════════════════════════════════════════════════


def run_graph_fraud_detection():
    print("\n🔗 BHIMA ASTRA — Graph Fraud Detection Pipeline")

    # ✅ Use workers_graph.csv (identity columns intact)
    workers_graph = pd.read_csv("data/processed/workers_graph.csv")
   
    # Attach fraud_risk_score from workers_clean for scoring
    workers_clean = pd.read_csv("data/processed/workers_clean.csv")
    risk_map      = dict(zip(
        workers_clean["worker_id"],
        workers_clean.get("fraud_risk_score",
                          pd.Series(0, index=workers_clean.index))
    ))
    workers_graph["fraud_risk_score"] = workers_graph["worker_id"].map(
        risk_map).fillna(0)

    G         = fraud_graph_builder(workers_graph)
    
    claims_raw = pd.read_csv("data/policy_claims.csv")
    G = add_time_window_edges(G, claims_raw)
    scores_df = compute_cluster_scores(G)

    os.makedirs("models", exist_ok=True)
    os.makedirs("data/processed", exist_ok=True)
    joblib.dump(G, "models/fraud_graph.pkl")
    scores_df.to_csv("data/processed/graph_scores.csv", index=False)

    print(f"\n✅ Graph pipeline complete")
    print(f"   models/fraud_graph.pkl")
    print(f"   data/processed/graph_scores.csv")
    return G, scores_df



if __name__ == "__main__":
    run_graph_fraud_detection()