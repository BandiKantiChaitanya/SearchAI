import os
import json
from urllib.parse import quote_plus
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import google.generativeai as genai
from typing import List, Dict, Optional # --- NEW ---

# --- 1. Load env ---
load_dotenv()
server = os.getenv("SQL_SERVER", "localhost")
database = os.getenv("SQL_DATABASE", "OnJobSupport")
username = os.getenv("SQL_USERNAME")
password = os.getenv("SQL_PASSWORD")
DRIVER = os.getenv("ODBC_DRIVER", "ODBC Driver 18 for SQL Server")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# --- 2. Build engine ---
def build_engine():
    if username and password:
        odbc_str = f"DRIVER={{{DRIVER}}};SERVER={server};DATABASE={database};UID={username};PWD={password};Encrypt=yes;TrustServerCertificate=yes;"
    else:
        odbc_str = f"DRIVER={{{DRIVER}}};SERVER={server};DATABASE={database};Trusted_Connection=yes;Encrypt=yes;TrustServerCertificate=yes;"
    uri = "mssql+pyodbc:///?odbc_connect=" + quote_plus(odbc_str)
    return create_engine(uri, fast_executemany=True)

engine = build_engine()

# --- 3. FastAPI ---
app = FastAPI(title="RAG Chatbot Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# --- MODIFIED: Added history to the request model ---
class QueryRequest(BaseModel):
    query: str
    force_detail: bool = False
    history: Optional[List[Dict[str, str]]] = None

# --- 4. Gemini helpers ---
def ensure_gemini():
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Missing GEMINI_API_KEY")
    genai.configure(api_key=GEMINI_API_KEY)
    return genai

def get_gemini_embedding(text: str, model="models/text-embedding-004"):
    gen = ensure_gemini()
    try:
        return gen.embed_content(model=model, content=text)["embedding"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failure: {e}")

def determine_response_mode(query: str, force_detail: bool = False) -> str:
    # ... (this function remains unchanged)
    q = query.strip().lower()
    if force_detail:
        return "detailed"
    if any(k in q for k in ["explain", "describe", "how", "step", "detailed", "details"]):
        return "detailed"
    if len(q.split()) <= 6 and not q.endswith("?"):
        return "short"
    return "default"

# --- MODIFIED: Function now accepts history and prompt is enhanced for tables ---
def generate_answer_with_gemini(query: str, context: str, history: Optional[List[Dict[str, str]]] = None, mode: str = "default"):
    gen = ensure_gemini()
    
    # Build a history string to prepend to the prompt
    history_str = ""
    if history:
        for turn in history:
            role = "User" if turn.get("role") == "user" else "Assistant"
            history_str += f"{role}: {turn.get('content')}\n"

    # --- ENHANCED PROMPT ---
        # --- Use your frontend-compatible prompt ---
    prompt = f"""
You are an expert-matching assistant for OnJobSupport. Based on the user's query and the available expert profiles, identify and suggest the most relevant experts.

Use the conversation below to understand the user's intent. Then, suggest experts from the given profiles.

If the user asks a general question like "Who are you" or "What can you do", just explain briefly:
- You're an AI assistant for OnJobSupport.
- You help users find the right experts/profiles/peoples who are freelancers you just show their profiles

Conversation:
{history_str}

User Query:
"{query}"

Expert Profiles:
{context}

Instructions:
- Understand the user query in context (e.g., if they say "his company", refer to the last expert mentioned).
- Identify up to 3 relevant experts based on the user's query.
- If no expert matches, say so briefly.
- Before listing the expert cards, write **1-2 friendly lines** introducing the results (e.g., “Sure! Here are some people who can help…”).
Always present expert results in the following format:

Product: [Expert/product Name]  
Description: [One-liner summary]  
Details: [More detailed explanation of how they help]


- If no experts match the query, say so politely and ask if the user wants help with something else.
- End by asking if the user wants more information or help with something else.

Respond in a helpful and friendly tone.
"""

    model = gen.GenerativeModel("gemini-2.5-flash")
    resp = model.generate_content(prompt)
    return getattr(resp, "text", str(resp)).strip()

# --- 5. API endpoints ---
@app.get("/")
def root():
    return {"message": "RAG backend up"}

# --- MODIFIED: The search function now passes history to the Gemini helper ---
@app.post("/search")
def search(req: QueryRequest):
    try:
        q = req.query.strip()
        if not q:
            raise HTTPException(status_code=400, detail="Empty query")

        embedding = get_gemini_embedding(q)
        dim = len(embedding)
        vec_json = json.dumps(embedding)

        sql = text(f"""
            SELECT TOP 3
              ProductID, Name, ShortDescription, FullDescription,
              VECTOR_DISTANCE('cosine', CAST(N'{vec_json}' AS VECTOR({dim})), Embedding) AS SimilarityScore
            FROM Products
            ORDER BY SimilarityScore ASC;
        """)
        with engine.connect() as conn:
            rows = conn.execute(sql).fetchall()

        if not rows:
            return {"query": q, "ai_answer": "I could not find any related products.", "retrieved_results": []}

        results = [dict(r._mapping) for r in rows]
        top = results[0]
        top_score = top.get("SimilarityScore", None)
        direct_match_threshold = 0.18

        if top_score is not None and top_score <= direct_match_threshold:
            ai_answer = f"Product: {top['Name']}\n\nDescription: {top['ShortDescription']}\n\nDetails: {top['FullDescription']}"
            return {"query": q, "ai_answer": ai_answer, "retrieved_results": results}

        context = "\n\n".join([
            f"Product: {r['Name']}\nShortDescription: {r.get('ShortDescription','')}\nFullDescription: {r.get('FullDescription','')}"
            for r in results
        ])

        mode = determine_response_mode(q, force_detail=req.force_detail)
        # Pass the conversation history to the generator
        answer = generate_answer_with_gemini(q, context, history=req.history, mode=mode)

        return {"query": q, "ai_answer": answer, "retrieved_results": results}

    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")