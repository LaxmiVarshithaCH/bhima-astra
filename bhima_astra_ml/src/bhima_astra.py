"""
=============================================================
BHIMA ASTRA — LLM Audit Assistant + RAG Chatbot
Senior AI Engineer & Lead Architect Implementation
=============================================================
Requirements:
    pip install sentence-transformers faiss-cpu openai numpy

Usage:
    python bhima_astra.py
=============================================================
"""
import time 
import os
import json
import math
import textwrap
import numpy as np
import re
from typing import List, Dict


# ── Optional imports with graceful fallback ──────────────────────────────────
try:
    from sentence_transformers import SentenceTransformer
    ST_AVAILABLE = True
except ImportError:
    ST_AVAILABLE = False
    print("[WARN] sentence-transformers not installed. RAG disabled.")

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("[WARN] faiss-cpu not installed. RAG disabled.")

try:
    from google import genai
    import os
    import json
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("[WARN] google-generativeai not installed. LLM calls will use mock responses.")


# =============================================================
# ── CONFIGURATION ─────────────────────────────────────────────
# =============================================================


# =============================================================
# ── CONFIGURATION ─────────────────────────────────────────────
# =============================================================

KNOWLEDGE_BASE_DIR = "knowledge_base"
EMBED_MODEL_NAME   = "all-MiniLM-L6-v2"
LLM_MODEL          = "gemini-3.1-flash-lite"  # FIX 4: Consistent model naming
CHUNK_MAX_WORDS    = 120                 # FIX 1: Smaller, precise chunks
CHUNK_OVERLAP      = 30                  # FIX 1: Sliding window overlap
RETRIEVE_TOP_K     = 4                   # Fetch slightly more, smaller chunks

FALLBACK_RESPONSE = json.dumps({
    "answer":     "I'm not fully confident based on the policy documents. Please contact support@bhimaastra.ai",
    "source":     "N/A",
    "confidence": "low"
})


# =============================================================
# PART 1 — DOCUMENT GENERATION (KNOWLEDGE BASE)
# =============================================================

def create_documents() -> None:
    """
    Creates the `knowledge_base/` folder and writes all 6 policy
    documents that form BHIMA ASTRA's retrieval corpus.
    """
    os.makedirs(KNOWLEDGE_BASE_DIR, exist_ok=True)

    docs = {

        # ── 1. SYSTEM LOGIC ───────────────────────────────────
        "SYSTEM_LOGIC.txt": textwrap.dedent("""\
            BHIMA ASTRA — SYSTEM LOGIC OVERVIEW
            ====================================

            STAGE 1: FRAUD ENGINE
            ---------------------
            The Fraud Engine is the first gate in the pipeline.
            It analyses incoming claim signals for anomalies before
            any payout decision is made.

            Detection inputs:
              - GPS Mismatch: compares rider-reported location with
                cell-tower and map data.
              - Speed Anomaly: flags abnormally high or zero speeds
                during the claimed disruption window.
              - Behavioral Patterns: unusual claim frequency, odd
                timing, or device fingerprint mismatches.
              - Graph Clustering: network analysis to detect
                coordinated fraud rings.

            Possible outputs:
              APPROVE  — No anomalies detected; proceed to Stage 2.
              REVIEW   — Suspicious signals found; hold for human review.
              BLOCK    — Clear fraud indicators; reject immediately.

            STAGE 2: MANAGER INTELLIGENCE AGENT
            ------------------------------------
            The Manager Agent verifies whether a real-world disruption
            actually occurred at the rider's location and time.

            Verification signals:
              - Route Feasibility: checks if alternate routes existed.
              - Rider Velocity: near-zero velocity confirms rider was stuck.
              - Crowd Signals: aggregated movement data from the zone.
              - External APIs: weather services, traffic APIs, news feeds.

            Possible outputs:
              CONFIRMED   — Disruption fully verified by multiple signals.
              PARTIAL     — Some evidence of disruption; alternate route may
                            exist or only part of the journey was affected.
              UNVERIFIED  — No independent evidence; claim not substantiated.

            STAGE 3: POLICY ENGINE
            ----------------------
            The Policy Engine applies business rules to compute the
            final payout decision.

            Rules applied:
              - Weekly claim limit (max 2 per rider per week).
              - Plan-based weekly payout caps (Basic / Standard / Premium).
              - API fallback cap: if external APIs fail, payout ≤ ₹400.
              - Trust Score adjustments (see below).

            Possible outputs:
              PAY    — Claim approved; payout amount computed.
              HOLD   — Flagged for manual review.
              REJECT — Claim does not meet policy criteria.

            TRUST SCORE SYSTEM
            ------------------
            Each rider carries a Trust Score (0–100) derived from
            their claim history, GPS accuracy, and platform tenure.

              High Trust (≥70): Thresholds relaxed; faster approvals.
              Medium Trust (40–69): Standard thresholds applied.
              Low Trust (<40): Strict thresholds; higher fraud scrutiny.

            Trust scores are updated after every resolved claim.
        """),

        # ── 2. CALCULATION ────────────────────────────────────
        "CALCULATION.txt": textwrap.dedent("""\
            BHIMA ASTRA — PAYOUT CALCULATION RULES
            =======================================

            EXPECTED LOSS FORMULA
            ---------------------
            Expected Loss = disruption_probability × (predicted_income
                            × severity_multiplier)

            Where:
              disruption_probability — float [0, 1] derived from Stage 2
                                       confidence score.
              predicted_income       — rider's estimated income for the
                                       disrupted period (₹).
              severity_multiplier    — determined by Manager decision:
                  CONFIRMED  → 1.0  (full disruption)
                  PARTIAL    → 0.3 to 0.7 (dynamic, based on route
                               feasibility score)
                  UNVERIFIED → 0.0  (no payout)

            PAYOUT THRESHOLDS
            -----------------
              Minimum payout threshold : ₹50
                  If computed payout < ₹50, claim is rejected as
                  economically insignificant.

              API failure cap          : ₹400
                  If one or more external APIs (weather, traffic, maps)
                  fail during processing, the payout is capped at ₹400
                  regardless of the computed value, to limit risk under
                  uncertain data.

            EXAMPLE CALCULATION
            -------------------
            Scenario: PARTIAL disruption, 60 % feasibility score.
              disruption_probability  = 0.75
              predicted_income        = ₹600
              severity_multiplier     = 0.5  (PARTIAL, mid-range)

            Expected Loss = 0.75 × (600 × 0.5) = 0.75 × 300 = ₹225

            Final payout = ₹225 (above ₹50 minimum, below plan cap).
        """),

        # ── 3. TRIGGERS ───────────────────────────────────────
        "TRIGGERS.txt": textwrap.dedent("""\
            BHIMA ASTRA — DISRUPTION TRIGGER DEFINITIONS
            =============================================

            RECOGNISED TRIGGER TYPES
            -------------------------
            1. Heavy Rainfall
               Condition: Rainfall intensity ≥ threshold (from weather API)
               causing roads to become impassable or dangerous.

            2. Traffic Blockage
               Condition: Major road blocked due to accident, construction,
               or flooding, confirmed via traffic API or crowd signals.

            3. Protests / Curfew
               Condition: Civic unrest, police curfew, or demonstration
               that physically prevents movement in a zone.

            ACTIVATION CRITERIA (ALL must hold)
            ------------------------------------
            A trigger is marked ACTIVE only when AT LEAST ONE of the
            following conditions is satisfied:

              a) No viable alternate route exists for the rider's O→D pair.
              b) Rider velocity is very low (< 2 km/h sustained for
                 ≥ 10 minutes in the disruption zone).
              c) Crowd signals (aggregated anonymised GPS) confirm
                 widespread movement stoppage in the zone.

            IMPORTANT:
              - A trigger event reported in the news but NOT confirmed
                by sensor/API data does NOT activate the system.
              - If no trigger is active at claim time → the claim is
                automatically REJECTED at Stage 2.
              - Multiple simultaneous triggers increase the disruption
                probability score but do not change the activation logic.

            TRIGGER EXPIRY
            --------------
            Each trigger has a validity window (e.g., 2 hours for
            rainfall, 4 hours for curfew). Claims submitted after the
            window expires are not eligible.
        """),

        # ── 4. POLICY ─────────────────────────────────────────
        "POLICY.txt": textwrap.dedent("""\
            BHIMA ASTRA — RIDER POLICY RULES
            =================================

            CLAIM FREQUENCY LIMITS
            ----------------------
            Maximum claims per rider per calendar week: 2

            If a rider submits a 3rd claim in the same week, it is
            automatically rejected by the Policy Engine regardless
            of disruption validity.

            WEEKLY PAYOUT CAPS (by subscription plan)
            ------------------------------------------
              Basic    plan : ₹600  per week
              Standard plan : ₹800  per week
              Premium  plan : ₹1200 per week

            If the total paid out in a week reaches the plan cap,
            any further claims that week will be rejected even if
            individually valid.

            MINIMUM PAYOUT
            --------------
            The minimum payout for any approved claim is ₹50.
            Claims where the computed Expected Loss falls below ₹50
            are rejected as economically insignificant.

            FRAUD & SUSPICIOUS ACTIVITY
            ----------------------------
            FRAUD DETECTED  → Immediate REJECTION. The rider's account
                              is flagged; repeated fraud leads to
                              permanent ban.
            SUSPICIOUS       → Claim is placed on HOLD for manual review
                              by the operations team within 24 hours.

            TRUST SCORE IMPACT ON POLICY
            -----------------------------
            A low Trust Score (<40) may lower the effective plan cap
            by up to 20 % and increase the minimum payout threshold
            to ₹100 until the score recovers.

            APPEALS & SUPPORT
            -----------------
            Riders may appeal a rejected claim by contacting:
            support@bhimaastra.ai within 7 days of the decision.
        """),

        # ── 5. FRAUD ──────────────────────────────────────────
        "FRAUD.txt": textwrap.dedent("""\
            BHIMA ASTRA — FRAUD DETECTION SYSTEM
            =====================================

            DETECTION METHODS
            -----------------
            1. GPS Mismatch
               The rider's self-reported location is cross-validated
               against cell-tower triangulation and historical GPS
               traces. Significant deviations flag the claim.

            2. Speed Anomalies
               Unnatural speed patterns (e.g., zero speed in a moving
               vehicle, or teleportation-like jumps) indicate GPS
               spoofing or false claims.

            3. Behavioral Patterns
               Machine-learning model trained on claim history:
               - Unusually high claim frequency.
               - Claims always submitted at the weekly limit boundary.
               - Device fingerprint shared across multiple accounts.

            4. Graph Clustering
               Network graph of riders, zones, and claim times is
               analysed for coordinated rings. Riders with abnormally
               high connectivity to other flagged accounts are reviewed.

            FRAUD DECISION OUTCOMES
            -----------------------
              BLOCK  → Fraud is confirmed with high confidence.
                       Claim is REJECTED immediately. Account flagged.

              REVIEW → Suspicious signals detected but not conclusive.
                       Claim is placed on HOLD. Human investigator
                       reviews within 24 hours.

              APPROVE → No fraud signals. Proceed to Stage 2.

            FALSE POSITIVE MANAGEMENT
            --------------------------
            Riders who believe they were incorrectly flagged can
            request a manual review via support@bhimaastra.ai.
            All BLOCK decisions are logged with the evidence snapshot
            used at decision time for auditability.

            DATA RETENTION
            --------------
            Fraud signals and audit logs are retained for 180 days
            in compliance with platform data governance policy.
        """),

        # ── 6. FAQ ────────────────────────────────────────────
        "FAQ.txt": textwrap.dedent("""\
            BHIMA ASTRA — FREQUENTLY ASKED QUESTIONS
            =========================================

            Q1: Why was my claim rejected?
            --------------------------------
            A claim may be rejected for one of three reasons:
              a) No active disruption was detected at your location
                 and time — the trigger conditions were not met.
              b) Fraud signals were detected on your account or device.
              c) You have exceeded your weekly claim or payout limit
                 for your current subscription plan.

            Q2: Why did I receive only a partial payout?
            ---------------------------------------------
            A partial payout is issued when:
              a) An alternate route existed that you could have taken,
                 meaning the disruption was not complete.
              b) The disruption was only partially verified — some
                 signals confirmed it, but others were inconclusive.
              In these cases the severity_multiplier is set between
              0.3 and 0.7 rather than the full 1.0.

            Q3: What if the system made a wrong decision?
            ---------------------------------------------
            You can raise a dispute or request a manual review by
            contacting our support team:
              Email : support@bhimaastra.ai
              SLA   : Response within 24 business hours.
            All decisions include a full audit log that the support
            team can examine.

            Q4: How do I improve my Trust Score?
            -------------------------------------
            Maintain accurate GPS, avoid suspicious claim patterns,
            and have a long clean history on the platform. Trust
            Scores are recalculated after each resolved claim.

            Q5: What is the API failure cap?
            ---------------------------------
            If external APIs (weather, traffic, maps) are unavailable
            during claim processing, the maximum payout is capped at
            ₹400 to manage risk under incomplete data.

            Q6: How many claims can I submit per week?
            ------------------------------------------
            A maximum of 2 claims per calendar week, subject to your
            plan's weekly payout cap (Basic ₹600 / Standard ₹800 /
            Premium ₹1200).
        """),
    }

    for filename, content in docs.items():
        filepath = os.path.join(KNOWLEDGE_BASE_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as fh:
            fh.write(content)
        print(f"[DOC] Created: {filepath}")

    print(f"\n✅  Knowledge base written to ./{KNOWLEDGE_BASE_DIR}/\n")


# =============================================================
# PART 2 — RAG ENGINE (FAISS + SENTENCE TRANSFORMERS)
# =============================================================

class RAGEngine:
    """
    Retrieval-Augmented Generation engine.
    Loads knowledge-base text files, chunks them, embeds with
    SentenceTransformer, and indexes with FAISS for fast retrieval.
    """

    def __init__(self, kb_dir: str = KNOWLEDGE_BASE_DIR):
        self.kb_dir   = kb_dir
        self.chunks   : List[Dict] = []   # [{"text": ..., "source": ...}]
        self.index    = None              # faiss.IndexFlatIP
        self.model    = None              # SentenceTransformer
        self._ready   = False

        if not (ST_AVAILABLE and FAISS_AVAILABLE):
            print("[RAG] RAG disabled — missing dependencies.")
            return

        self._load_and_index()

    # ── DOCUMENT LOADING ──────────────────────────────────────
    def _load_documents(self) -> List[Dict]:
        """
        Reads every .txt file in the knowledge-base directory.
        Returns a list of {"text": full_text, "source": filename}.
        """
        raw_docs = []
        for fname in sorted(os.listdir(self.kb_dir)):
            if fname.endswith(".txt"):
                fpath = os.path.join(self.kb_dir, fname)
                with open(fpath, "r", encoding="utf-8") as fh:
                    raw_docs.append({"text": fh.read(), "source": fname})
                print(f"[RAG] Loaded: {fname}")
        return raw_docs

    # ── CHUNKING ──────────────────────────────────────────────
    def _chunk_document(self, doc: dict) -> List[Dict]:
        """
        Splits a document into chunks using a sliding window approach.
        CRITICAL: Each chunk stores {"text": ..., "source": ...}.
        """
        words  = doc["text"].split()
        chunks = []
        step = CHUNK_MAX_WORDS - CHUNK_OVERLAP
        
        for i in range(0, len(words), step):
            chunk_text = " ".join(words[i : i + CHUNK_MAX_WORDS])
            chunks.append({
                "text":   chunk_text,
                "source": doc["source"]
            })
            if i + CHUNK_MAX_WORDS >= len(words):
                break
                
        return chunks

    # ── EMBEDDING + INDEXING ──────────────────────────────────
    def _load_and_index(self) -> None:
        """Loads docs → chunks → embeds → FAISS index."""
        raw_docs = self._load_documents()

        for doc in raw_docs:
            self.chunks.extend(self._chunk_document(doc))

        print(f"[RAG] Total chunks: {len(self.chunks)}")
        print("[RAG] Building FAISS index... (this may take a few seconds)")

        # Embed all chunks
        self.model = SentenceTransformer(EMBED_MODEL_NAME)
        texts      = [c["text"] for c in self.chunks]
        embeddings = self.model.encode(texts, show_progress_bar=True,
                                       normalize_embeddings=True)
        embeddings = np.array(embeddings, dtype="float32")

        # Build FAISS inner-product index (cosine sim on normalised vectors)
        dim         = embeddings.shape[1]
        self.index  = faiss.IndexFlatIP(dim)
        self.index.add(embeddings)

        self._ready = True
        print(f"[RAG] FAISS index built — {self.index.ntotal} vectors, dim={dim}\n")

    # ── RETRIEVAL ─────────────────────────────────────────────
   # ── RETRIEVAL ─────────────────────────────────────────────
    def retrieve(self, query: str, k: int = RETRIEVE_TOP_K) -> List[Dict]:
        """
        Retrieves the top-k most relevant chunks using semantic + keyword hybrid scoring.
        """
        if not self._ready:
            return []

        # Clean the query to reduce noise
        query = re.sub(r"[^\w\s]", "", query.lower()).strip()

        query_vec = self.model.encode([query], normalize_embeddings=True)
        query_vec = np.array(query_vec, dtype="float32")

        distances, indices = self.index.search(query_vec, k * 2) # Fetch extra for filtering
        query_words = set(query.lower().split())
        
        top_chunks = []
        for idx, score in zip(indices[0], distances[0]):
            # FIX 2 & 7: Retrieval Filtering (Discard low confidence)
            if 0 <= idx < len(self.chunks) and score > 0.40:
                chunk = self.chunks[idx].copy()
                
                # HYBRID SEARCH BOOST: Boost score if query words are in the text
                keyword_matches = sum(1 for w in query_words if w in chunk["text"].lower())
                keyword_boost = min(0.15, keyword_matches * 0.02) 
                
                chunk["score"] = float(score) + keyword_boost
                top_chunks.append(chunk)

        # Sort by new hybrid score and take top K
        top_chunks = sorted(top_chunks, key=lambda x: x["score"], reverse=True)[:k]

        print("DEBUG: Retrieved docs:", [chunk["source"] for chunk in top_chunks])
        return top_chunks


# =============================================================
# PART 3 — LLM INTEGRATION & STRICT CONTROLS
# =============================================================

def generate_answer(query, retrieved_chunks):
    # Guardrail - Do not call LLM if retrieval failed completely
    if not retrieved_chunks:
        return json.loads(FALLBACK_RESPONSE)

    # 1. Combine context
    context_text = ""
    sources = set()
    for chunk in retrieved_chunks:
        context_text += f"Source ({chunk['source']}):\n{chunk['text']}\n\n"
        sources.add(chunk['source'])
        
    source_str = ", ".join(sources) if sources else "N/A"

    # 🔥 GAP 2 FIX: Determine language from query for ONE-SHOT translation
    if "telugu" in query.lower():
        language_instruction = "Respond in Telugu."
    elif "hindi" in query.lower():
        language_instruction = "Respond in Hindi."
    else:
        language_instruction = "Respond in English."

    # 2. Strict Prompt Formulation
    prompt = f"""
    You are a strict policy assistant for BHIMA ASTRA.
    
    Rules:
    1. Answer ONLY using the provided context.
    2. If the answer is not clearly found, respond: "I don't know".
    3. DO NOT infer or assume anything.
    4. Cite the source document names clearly in your answer.
    5. {language_instruction}
    
    Return STRICT JSON:
    {{
      "answer": "...",
      "source": "{source_str}",
      "confidence": "high/medium/low"
    }}

    Context:
    {context_text}

    Question:
    {query}
    """

    # Use the new SDK Client syntax (same as your translate function)
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "your_key"))
    
    for attempt in range(3): # Try up to 3 times
        try:
            response = client.models.generate_content(
                model=LLM_MODEL,
                contents=prompt
            )
            result_text = response.text.replace("```json", "").replace("```", "").strip()
            
            try:
                parsed = json.loads(result_text)
            except:
                parsed = json.loads(FALLBACK_RESPONSE)
            
            for key in ["answer", "source", "confidence"]:
                if key not in parsed:
                    parsed[key] = "N/A"
                    
            # 🔥 FIX: If the LLM doesn't know or fallback is triggered, remove the source.
            if "I don't know" in parsed["answer"] or "not fully confident" in parsed["answer"]:
                parsed["source"] = "N/A"
                parsed["confidence"] = "low"
            else:
                parsed["source"] = source_str
                
            return parsed

        except Exception as e:
            if "503" in str(e) and attempt < 2:
                print(f"[LLM] API overloaded (503). Retrying in 2 seconds... (Attempt {attempt + 1}/3)")
                time.sleep(2) # Wait 2 seconds and try again
                continue
            else:
                print(f"[LLM] API error: {e}")
                return json.loads(FALLBACK_RESPONSE)
    


# =============================================================
# PART 4 — CHATBOT ENGINE & ROUTER
# =============================================================

class BhimaChatbot:
    """
    Main chatbot class.  Combines claim explainability with
    RAG-based policy Q&A through an intelligent query router.
    """

    def __init__(self):
        self.rag = RAGEngine()
        print("✅  BhimaChatbot initialised.\n")

    # ── 4.1 CLAIM EXPLAINABILITY ──────────────────────────────
    # ── 4.1 CLAIM EXPLAINABILITY ──────────────────────────────
    def explain_claim(self, final_result: dict, target_lang: str = "English") -> str:
        """
        Generates a human-readable explanation of a claim decision using the Fused Audit Object.
        Uses Gemini LLM to create a natural, multilingual response.
        """
        # 🔥 FIX 4: Safety check if fused audit is missing/incomplete
        if not final_result or "user_facing_reasons" not in final_result:
            status = final_result.get("final_decision", final_result.get("final_action", "UNKNOWN")) if final_result else "UNKNOWN"
            return f"Claim processed. Status: {status}"

        action     = final_result.get("final_decision", "UNKNOWN")
        payout     = final_result.get("payout_amount", 0.0)
        reasons    = "\n- ".join(final_result.get("user_facing_reasons", []))
        policy     = final_result.get("policy_context", "")
        tone       = final_result.get("suggested_tone", "neutral")

        prompt = f"""
        You are the BHIMA ASTRA support assistant. Explain a claim decision to a gig worker.
        
        CLAIM DETAILS:
        - Decision: {action}
        - Payout Amount: ₹{payout:.2f}
        
        REASONS:
        - {reasons}
        
        POLICY CONTEXT:
        {policy}
        
        INSTRUCTIONS:
        1. Write the explanation in {target_lang}.
        2. Adopt a {tone} tone.
        3. Be clear, direct, and do not use technical jargon. Do not mention "SHAP", "ML", or "Graph".
        4. If the decision is REJECT or HOLD, clearly state the reasons bulleted above.
        5. If the decision is PAY, congratulate them.
        """

        # Call your LLM
        try:
            client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "your_api"))
            response = client.models.generate_content(
                model=LLM_MODEL,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"[LLM] Error generating explanation: {e}")
            return f"Decision: {action}. Payout: ₹{payout}. Reasons: \n- {reasons}"

    # ── 4.2 RAG ANSWER ────────────────────────────────────────
    def rag_answer(self, question: str) -> dict:
        """
        Retrieves relevant policy chunks and generates an LLM answer.
        Returns the parsed JSON dict.
        """
        chunks = self.rag.retrieve(question)
        
        # If retrieval is weak, do NOT call LLM (prevents hallucination)
        scores = [c.get("score", 0) for c in chunks]
        threshold = max(0.45, np.mean(scores))
        if not scores or np.percentile(scores, 75) < threshold:
            return json.loads(FALLBACK_RESPONSE)
        
        # generate_answer already returns a parsed dictionary! No need for json.loads here.
        result = generate_answer(question, chunks)

        # 🔥 Override LLM confidence with actual FAISS scores
        if chunks:
            scores = [c["score"] for c in chunks if "score" in c]
            avg_score = sum(scores) / len(scores) if scores else 0
            if avg_score > 0.55:
                result["confidence"] = "high"
            elif avg_score > 0.4:
                result["confidence"] = "medium"
            else:
                result["confidence"] = "low"
        else:
            result["confidence"] = "low"

        return result
    
    # ── 4.3 CHATBOT ROUTER ────────────────────────────────────
    # ── 4.3 CHATBOT ROUTER ────────────────────────────────────
    def chatbot(self, query: str, final_result: dict = None) -> str:
        """
        Intelligent router with translation integration.
        """
        claim_keywords = ["claim", "status", "decision", "payout", "rejected", "approved", "explain"]
        
        # 1. Claim Explainability Routing
        # 1. Claim Explainability Routing
        if final_result and any(k in query.lower() for k in claim_keywords):
            # 🔥 FIX 5: Extract language routing directly
            target_lang = "English"
            if "telugu" in query.lower() or "te" in query.lower().split():
                target_lang = "Telugu"
            elif "hindi" in query.lower() or "hi" in query.lower().split():
                target_lang = "Hindi"
                
            ans = self.explain_claim(final_result, target_lang=target_lang)
            return ans

    
        # 2. RAG Policy Routing
        result  = self.rag_answer(query)
        answer  = result.get("answer",     "No answer found.")
        source  = result.get("source",     "N/A")
        conf    = result.get("confidence", "N/A")

        # 🔥 GAP 2 FIX: Removed the double LLM call here!
        # The prompt instruction handles it natively now.

        return (
            f"\n{'─'*60}\n"
            f"  💬 Answer     : {answer}\n"
            f"  📄 Source     : {source}\n"
            f"  🎯 Confidence : {conf}\n"
            f"{'─'*60}\n"
        )


# =============================================================
# PART 5 — TRANSLATION (MOCK) + TEST BLOCK
# =============================================================

def translate(text: str, target_lang: str = "en") -> str:
    """
    🔥 Fast, zero-cost mock translation. 
    Avoids double LLM API calls to keep the demo instant.
    """
    if target_lang == "en":
        return text
        
    # Hardcoded dictionary for specific demo lines to look impressive without API cost
    demo_dict = {
        "te": {
            "Your claim has been approved": "మీ క్లెయిమ్ ఆమోదించబడింది",
            "Your claim has been rejected": "మీ క్లెయిమ్ తిరస్కరించబడింది",
        },
        "hi": {
            "Your claim has been approved": "आपका दावा स्वीकृत कर लिया गया है",
            "Your claim has been rejected": "आपका दावा अस्वीकार कर दिया गया है",
        }
    }
    
    if text in demo_dict.get(target_lang, {}):
        return demo_dict[target_lang][text]
        
    # Fallback for large text blocks (like the full explanation string)
    prefix = {"te": "🌐 [Telugu Translation]\n", "hi": "🌐 [Hindi Translation]\n"}.get(target_lang, "")
    return prefix + text


# =============================================================
# MAIN — DEMO / TEST BLOCK
# =============================================================

if __name__ == "__main__":

    print("\n" + "=" * 60)
    print("  BHIMA ASTRA — DEMO RUN")
    print("=" * 60 + "\n")

    # ── Step 1: Create knowledge base ────────────────────────
    print("📁  STEP 1: Generating knowledge base documents …\n")
    create_documents()

    # ── Step 2: Boot chatbot (builds FAISS index) ─────────────
    print("🤖  STEP 2: Initialising BhimaChatbot …\n")
    bot = BhimaChatbot()

    # ─────────────────────────────────────────────────────────
    # TEST A: Claim Explanation
    # Rich final_result dict simulating a real system output
    # ─────────────────────────────────────────────────────────
    print("\n" + "━" * 60)
    print("  TEST A — CLAIM EXPLANATION")
    print("━" * 60)

    mock_final_result = {
        "final_action":        "PAY",
        "final_payout_amount": 225.00,
        "fraud_decision":      "APPROVE",
        "risk_index":          0.22,
        "manager_decision":    "PARTIAL",
        "audit_log": [
            "Stage 1 (Fraud Engine)   : No anomalies detected → APPROVE",
            "Stage 2 (Manager Agent)  : Route feasibility 45%, "
            "velocity 1.2 km/h → PARTIAL disruption",
            "Stage 3 (Policy Engine)  : Within weekly limit, "
            "payout ₹225 within Standard cap → PAY",
            "Trust Score              : 72 (HIGH) — standard thresholds applied",
        ],
    }

    response_a = bot.chatbot(
        query        = "What is my claim status?",
        final_result = mock_final_result,
    )
    print(response_a)

    # Translate to Telugu as a demo
    te_line = translate("Your claim has been approved", target_lang="te")
    print(f"  🌐 Telugu : {te_line}\n")

    # ─────────────────────────────────────────────────────────
    # TEST B: RAG Policy Q&A (in-bounds question)
    # ─────────────────────────────────────────────────────────
    print("━" * 60)
    print("  TEST B — RAG POLICY QUESTION (IN-BOUNDS)")
    print("━" * 60)

    question_b = "What is the maximum payout for the Standard plan?"
    print(f"  ❓ Question : {question_b}")
    response_b = bot.chatbot(query=question_b)
    print(response_b)

    # ─────────────────────────────────────────────────────────
    # TEST C: Out-of-bounds question (proves fallback)
    # ─────────────────────────────────────────────────────────
    print("━" * 60)
    print("  TEST C — OUT-OF-BOUNDS QUESTION (FALLBACK TEST)")
    print("━" * 60)

    question_c = "What is BHIMA ASTRA's stock price today?"
    print(f"  ❓ Question : {question_c}")
    response_c = bot.chatbot(query=question_c)
    print(response_c)

    # ─────────────────────────────────────────────────────────
    # TEST D: Fraud-related policy question
    # ─────────────────────────────────────────────────────────
    print("━" * 60)
    print("  TEST D — FRAUD POLICY QUESTION")
    print("━" * 60)

    question_d = "How does BHIMA ASTRA detect GPS spoofing?"
    print(f"  ❓ Question : {question_d}")
    response_d = bot.chatbot(query=question_d)
    print(response_d)

    # Hindi translation demo
    hi_line = translate("Your claim has been rejected", target_lang="hi")
    print(f"  🌐 Hindi   : {hi_line}\n")

    print("=" * 60)
    print("  ✅  BHIMA ASTRA demo complete.")
    print("=" * 60 + "\n")