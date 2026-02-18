from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import requests
from datetime import datetime
from typing import Optional, List
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import pandas as pd
import io
import os
import json
import time
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env", override=True)

# ---------------------------
# Logging
# ---------------------------

# ---------------------------
# Environment
# ---------------------------

APP_ENV = os.getenv("APP_ENV", "development")  # "development" or "production"
IS_PROD = APP_ENV == "production"
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "")  # Optional: protect write endpoints
RATE_LIMIT_SEARCH = os.getenv("RATE_LIMIT_SEARCH", "30/minute")
RATE_LIMIT_SUMMARIZE = os.getenv("RATE_LIMIT_SUMMARIZE", "10/minute")
RATE_LIMIT_EXPORT = os.getenv("RATE_LIMIT_EXPORT", "5/minute")
RATE_LIMIT_SCOPUS = os.getenv("RATE_LIMIT_SCOPUS", "20/minute")

log_level = logging.WARNING if IS_PROD else logging.INFO
logging.basicConfig(
    level=log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)  # Always log INFO for our app

logger.info(f"Starting ScholarAI API — env={APP_ENV}")

# ---------------------------
# Rate Limiter
# ---------------------------

limiter = Limiter(key_func=get_remote_address)

# ---------------------------
# App Setup
# ---------------------------

app = FastAPI(
    title="ScholarAI - Academic Research Search",
    description="AI-enhanced academic research paper discovery with hybrid ranking, "
                "powered by OpenAlex (260M+ scholarly works). "
                "Features: AI summaries, advanced filtering, citation export.",
    version="2.0.0",
    docs_url=None if IS_PROD else "/docs",
    redoc_url=None if IS_PROD else "/redoc",
    openapi_url=None if IS_PROD else "/openapi.json",
)

app.state.limiter = limiter

# Rate limit exceeded handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down.", "retry_after": str(exc.detail)}
    )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {type(exc).__name__}: {exc}", exc_info=not IS_PROD)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error" if IS_PROD else str(exc)}
    )

# CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    max_age=3600,
)

# Security headers + request logging middleware
@app.middleware("http")
async def security_and_logging_middleware(request: Request, call_next):
    start = time.time()
    response: Response = await call_next(request)
    duration = round((time.time() - start) * 1000, 1)

    # Log request (skip health checks in production to reduce noise)
    if not (IS_PROD and request.url.path == "/health"):
        logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)")

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if IS_PROD:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# ---------------------------
# Config
# ---------------------------

OPENALEX_BASE = "https://api.openalex.org"
WORKS_URL = f"{OPENALEX_BASE}/works"
AUTOCOMPLETE_URL = f"{OPENALEX_BASE}/autocomplete/works"
REQUEST_TIMEOUT = 15
OPENALEX_EMAIL = os.getenv("OPENALEX_EMAIL", "")

# LLM Config — Ollama (free, local) is preferred; OpenAI is optional fallback
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto")  # "ollama", "openai", or "auto"

# Scopus API (optional, free key from dev.elsevier.com)
SCOPUS_API_KEY = os.getenv("SCOPUS_API_KEY", "")
SCOPUS_SEARCH_URL = "https://api.elsevier.com/content/search/scopus"


# ---------------------------
# Utility Functions
# ---------------------------

def normalize(value, max_value):
    if not value or not max_value:
        return 0
    return value / max_value


def reconstruct_abstract(inv_index):
    if not inv_index:
        return ""
    word_positions = []
    for word, positions in inv_index.items():
        for pos in positions:
            word_positions.append((pos, word))
    word_positions.sort()
    return " ".join([w[1] for w in word_positions])


def get_snippet(text, max_chars=500):
    if not text:
        return ""
    snippet = text[:max_chars]
    last_period = snippet.rfind(".")
    if last_period != -1:
        snippet = snippet[:last_period + 1]
    return snippet.strip()


def safe_journal_info(item):
    primary_location = item.get("primary_location") or {}
    source = primary_location.get("source") or {}
    journal_name = source.get("display_name") or "Unknown Journal"
    publisher_name = source.get("host_organization_name") or "Unknown Publisher"
    return journal_name, publisher_name


def extract_authors(item, max_authors=5):
    authorships = item.get("authorships") or []
    authors = []
    for a in authorships[:max_authors]:
        author = a.get("author") or {}
        name = author.get("display_name")
        if name:
            authors.append({
                "name": name,
                "id": author.get("id", ""),
                "orcid": author.get("orcid", "")
            })
    if len(authorships) > max_authors:
        authors.append({"name": f"+{len(authorships) - max_authors} more", "id": "", "orcid": ""})
    return authors


def extract_concepts(item, max_concepts=5):
    concepts = item.get("concepts") or []
    return [
        {"name": c.get("display_name", ""), "score": round(c.get("score", 0), 2)}
        for c in concepts[:max_concepts]
        if c.get("score", 0) > 0.3
    ]


def get_openalex_params():
    params = {}
    if OPENALEX_EMAIL:
        params["mailto"] = OPENALEX_EMAIL
    return params


def format_bibtex(paper):
    author_str = " and ".join([a["name"] for a in paper.get("authors", []) if a.get("name") and "more" not in a["name"]])
    doi = paper.get("doi", "") or ""
    key = doi.split("/")[-1] if doi else paper.get("title", "unknown")[:20].replace(" ", "_")
    year = paper.get("year", "")
    return (
        f"@article{{{key},\n"
        f"  title = {{{paper.get('title', '')}}},\n"
        f"  author = {{{author_str}}},\n"
        f"  journal = {{{paper.get('journal', '')}}},\n"
        f"  year = {{{year}}},\n"
        f"  doi = {{{doi}}},\n"
        f"  publisher = {{{paper.get('publisher', '')}}}\n"
        f"}}\n"
    )


def format_apa(paper):
    authors = paper.get("authors", [])
    author_names = [a["name"] for a in authors if a.get("name") and "more" not in a["name"]]
    if len(author_names) == 0:
        author_str = "Unknown"
    elif len(author_names) == 1:
        author_str = author_names[0]
    elif len(author_names) == 2:
        author_str = f"{author_names[0]} & {author_names[1]}"
    else:
        author_str = ", ".join(author_names[:-1]) + f", & {author_names[-1]}"
    year = paper.get("year", "n.d.")
    title = paper.get("title", "")
    journal = paper.get("journal", "")
    doi = paper.get("doi", "")
    citation = f"{author_str} ({year}). {title}. *{journal}*."
    if doi:
        citation += f" {doi}"
    return citation


def check_scopus_doi(doi: str) -> dict:
    """Check if a paper exists in Scopus by DOI. Returns Scopus ID and link if found."""
    if not SCOPUS_API_KEY or not doi:
        return {"indexed": False, "scopus_url": None, "scopus_id": None}
    
    clean_doi = doi.replace("https://doi.org/", "")
    try:
        resp = requests.get(
            SCOPUS_SEARCH_URL,
            headers={"X-ELS-APIKey": SCOPUS_API_KEY, "Accept": "application/json"},
            params={"query": f"DOI({clean_doi})", "count": 1},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            total = int(data.get("search-results", {}).get("opensearch:totalResults", 0))
            if total > 0:
                entry = data["search-results"]["entry"][0]
                scopus_id = entry.get("dc:identifier", "").replace("SCOPUS_ID:", "")
                # Build Scopus abstract link
                scopus_link = None
                for link in entry.get("link", []):
                    if link.get("@ref") == "scopus":
                        scopus_link = link.get("@href")
                        break
                return {"indexed": True, "scopus_url": scopus_link, "scopus_id": scopus_id}
    except Exception as e:
        logger.debug(f"Scopus check failed for {doi}: {e}")
    return {"indexed": False, "scopus_url": None, "scopus_id": None}


def get_scopus_search_url(title: str) -> str:
    """Generate a Scopus search URL for a paper title (no API key needed)."""
    from urllib.parse import quote
    return f"https://www.scopus.com/results/results.uri?sort=plf-f&src=s&sot=b&sdt=b&sl=50&s=TITLE%28{quote(title)}%29"


def build_paper_result(item, start_year, end_year, max_citations):
    relevance = item.get("relevance_score") or 0
    citations = item.get("cited_by_count", 0)
    year = item.get("publication_year", 0)

    citation_score = normalize(citations, max_citations) if max_citations else 0
    year_range = max(end_year - start_year, 1)
    recency_score = normalize(year - start_year, year_range) if year else 0

    final_score = (
        relevance * 0.5 +
        citation_score * 0.3 +
        recency_score * 0.2
    )

    abstract_raw = reconstruct_abstract(item.get("abstract_inverted_index"))
    snippet = get_snippet(abstract_raw) or "No abstract available."

    journal_name, publisher_name = safe_journal_info(item)
    authors = extract_authors(item)
    concepts = extract_concepts(item)

    openalex_id = item.get("id", "")

    doi = item.get("doi") or ""
    title = item.get("title") or ""

    # Scopus: generate search link (always), check indexing (if API key set)
    scopus_search_link = get_scopus_search_url(title) if title else None

    return {
        "id": openalex_id,
        "title": title,
        "year": year,
        "authors": authors,
        "journal": journal_name,
        "publisher": publisher_name,
        "citations": citations,
        "open_access": item.get("open_access", {}).get("is_oa", False),
        "oa_url": item.get("open_access", {}).get("oa_url", ""),
        "doi": doi,
        "abstract": abstract_raw,
        "summary": snippet,
        "concepts": concepts,
        "type": item.get("type", ""),
        "score": round(final_score, 4),
        "scopus_search_url": scopus_search_link,
    }


# ---------------------------
# Search Endpoint
# ---------------------------

@app.get("/search")
@limiter.limit(RATE_LIMIT_SEARCH)
def search_papers(
    request: Request,
    topic: str = Query(..., description="Research topic or keywords"),
    limit: int = Query(10, ge=1, le=50, description="Results per page"),
    page: int = Query(1, ge=1, description="Page number"),
    start_year: Optional[int] = Query(None, description="Start year filter"),
    end_year: Optional[int] = Query(None, description="End year filter"),
    open_access_only: bool = Query(False, description="Only open access papers"),
    min_citations: int = Query(0, ge=0, description="Minimum citation count"),
    sort_by: str = Query("relevance", description="Sort: relevance, citations, year_desc, year_asc"),
    type_filter: Optional[str] = Query(None, description="Work type: article, review, book-chapter, etc."),
    author: Optional[str] = Query(None, description="Author name filter"),
):
    current_year = datetime.now().year

    if not start_year:
        start_year = current_year - 5
    if not end_year:
        end_year = current_year

    filters = [
        f"from_publication_date:{start_year}-01-01",
        f"to_publication_date:{end_year}-12-31",
    ]

    if open_access_only:
        filters.append("open_access.is_oa:true")

    if min_citations > 0:
        filters.append(f"cited_by_count:>{min_citations}")

    if type_filter:
        filters.append(f"type:{type_filter}")

    if author:
        # Resolve author name to OpenAlex author ID (display_name.search is not a valid filter)
        try:
            author_resp = requests.get(
                f"{OPENALEX_BASE}/autocomplete/authors",
                params={**get_openalex_params(), "q": author},
                timeout=REQUEST_TIMEOUT
            )
            author_resp.raise_for_status()
            author_results = author_resp.json().get("results", [])
            if author_results:
                author_id = author_results[0]["id"]
                filters.append(f"authorships.author.id:{author_id}")
                logger.info(f"Resolved author '{author}' → {author_id} ({author_results[0]['display_name']})")
            else:
                logger.warning(f"Author '{author}' not found in OpenAlex, skipping author filter")
        except Exception as e:
            logger.warning(f"Author lookup failed for '{author}': {e}")

    sort_mapping = {
        "relevance": "relevance_score:desc",
        "citations": "cited_by_count:desc",
        "year_desc": "publication_year:desc",
        "year_asc": "publication_year:asc",
    }

    params = {
        **get_openalex_params(),
        "search": topic,
        "filter": ",".join(filters),
        "sort": sort_mapping.get(sort_by, "relevance_score:desc"),
        "per_page": 50,
        "page": page,
    }

    try:
        response = requests.get(WORKS_URL, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        logger.error(f"OpenAlex API error: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch from OpenAlex: {str(e)}")

    papers = data.get("results", [])
    total_count = data.get("meta", {}).get("count", 0)

    if not papers:
        return {
            "topic": topic,
            "years_filter": f"{start_year}-{end_year}",
            "total_found": 0,
            "total_journals": 0,
            "page": page,
            "results": []
        }

    max_citations = max([p.get("cited_by_count", 0) for p in papers]) or 1
    ranked_results = []
    journal_set = set()

    for item in papers:
        paper = build_paper_result(item, start_year, end_year, max_citations)
        journal_set.add(paper["journal"])
        ranked_results.append(paper)

    if sort_by == "relevance":
        ranked_results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "topic": topic,
        "years_filter": f"{start_year}-{end_year}",
        "total_found": total_count,
        "total_journals": len(journal_set),
        "page": page,
        "per_page": limit,
        "results": ranked_results[:limit]
    }


# ---------------------------
# Scopus Check Endpoint
# ---------------------------

@app.get("/scopus/check")
@limiter.limit(RATE_LIMIT_SCOPUS)
def scopus_check(request: Request, doi: str = Query(..., description="DOI to check in Scopus")):
    """Check if a paper is indexed in Scopus by its DOI."""
    if not SCOPUS_API_KEY:
        raise HTTPException(status_code=503, detail="Scopus API key not configured. Set SCOPUS_API_KEY in .env")
    result = check_scopus_doi(doi)
    return result


# ---------------------------
# LLM Helpers
# ---------------------------

def check_ollama_available():
    """Check if Ollama is running and the model is available."""
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if resp.status_code == 200:
            models = [m.get("name", "").split(":")[0] for m in resp.json().get("models", [])]
            return OLLAMA_MODEL.split(":")[0] in models
    except Exception:
        pass
    return False


def get_active_llm_provider():
    """Determine which LLM provider to use."""
    if LLM_PROVIDER == "openai" and OPENAI_API_KEY:
        return "openai"
    if LLM_PROVIDER == "ollama":
        return "ollama"
    # auto mode: try Ollama first (free), then OpenAI
    if check_ollama_available():
        return "ollama"
    if OPENAI_API_KEY:
        return "openai"
    return None


def summarize_with_ollama(prompt: str) -> str:
    """Generate summary using local Ollama model."""
    resp = requests.post(
        f"{OLLAMA_BASE_URL}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 300
            }
        },
        timeout=60  # local models can be slower
    )
    resp.raise_for_status()
    return resp.json()["message"]["content"].strip()


def summarize_with_openai(prompt: str) -> str:
    """Generate summary using OpenAI API."""
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "model": OPENAI_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 300,
            "temperature": 0.3
        },
        timeout=30
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


# ---------------------------
# AI Summary Endpoint
# ---------------------------

@app.post("/summarize")
@limiter.limit(RATE_LIMIT_SUMMARIZE)
def summarize_paper(request: Request, body: dict):
    provider = get_active_llm_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="No AI provider available. Install Ollama (free) or set OPENAI_API_KEY in .env"
        )

    title = body.get("title", "")
    abstract = body.get("abstract", "")

    if not abstract or abstract == "No abstract available.":
        raise HTTPException(
            status_code=400, 
            detail="This paper doesn't have an abstract available, so we can't generate a summary. Try another paper!"
        )

    prompt = (
        "You are a research assistant. Summarize this academic paper in 3-4 clear sentences. "
        "Focus on: (1) the research objective, (2) the methodology, (3) key findings. "
        "Use simple language accessible to graduate students.\n\n"
        f"Title: {title}\n\nAbstract: {abstract}"
    )

    try:
        if provider == "ollama":
            logger.info(f"Summarizing with Ollama ({OLLAMA_MODEL})")
            summary = summarize_with_ollama(prompt)
        else:
            logger.info(f"Summarizing with OpenAI ({OPENAI_MODEL})")
            summary = summarize_with_openai(prompt)
        return {"summary": summary, "provider": provider}
    except requests.Timeout:
        logger.error(f"LLM timeout ({provider})")
        raise HTTPException(
            status_code=504, 
            detail="AI is taking too long to respond. The model might be busy - please try again in a moment."
        )
    except requests.RequestException as e:
        logger.error(f"LLM API error ({provider}): {e}")
        error_msg = "AI summary service is temporarily unavailable. "
        if provider == "ollama":
            error_msg += "Make sure Ollama is running on your system."
        else:
            error_msg += "Please check your API key and try again."
        raise HTTPException(status_code=502, detail=error_msg)


# ---------------------------
# Citation Export Endpoint
# ---------------------------

@app.post("/cite")
@limiter.limit(RATE_LIMIT_SEARCH)
def generate_citation(request: Request, body: dict):
    format_type = body.get("format", "bibtex")
    paper = body.get("paper", {})

    if not paper:
        raise HTTPException(status_code=400, detail="No paper data provided")

    if format_type == "bibtex":
        return {"citation": format_bibtex(paper)}
    elif format_type == "apa":
        return {"citation": format_apa(paper)}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format_type}")


# ---------------------------
# Batch Citation Export
# ---------------------------

@app.post("/cite/batch")
@limiter.limit(RATE_LIMIT_EXPORT)
def batch_citations(request: Request, body: dict):
    papers = body.get("papers", [])
    format_type = body.get("format", "bibtex")

    if not papers:
        raise HTTPException(status_code=400, detail="No papers provided")

    citations = []
    for paper in papers:
        if format_type == "bibtex":
            citations.append(format_bibtex(paper))
        elif format_type == "apa":
            citations.append(format_apa(paper))

    return {"citations": "\n".join(citations)}


# ---------------------------
# Excel Export Endpoint
# ---------------------------

@app.get("/export")
@limiter.limit(RATE_LIMIT_EXPORT)
def export_to_excel(
    request: Request,
    topic: str = Query(...),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    open_access_only: bool = Query(False),
    min_citations: int = Query(0),
):
    current_year = datetime.now().year
    if not start_year:
        start_year = current_year - 5
    if not end_year:
        end_year = current_year

    filters = [
        f"from_publication_date:{start_year}-01-01",
        f"to_publication_date:{end_year}-12-31",
    ]
    if open_access_only:
        filters.append("open_access.is_oa:true")
    if min_citations > 0:
        filters.append(f"cited_by_count:>{min_citations}")

    params = {
        **get_openalex_params(),
        "search": topic,
        "filter": ",".join(filters),
        "per_page": 50,
    }

    try:
        response = requests.get(WORKS_URL, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {str(e)}")

    papers = data.get("results", [])
    rows = []

    for item in papers:
        journal_name, publisher_name = safe_journal_info(item)
        authors = extract_authors(item)
        author_str = "; ".join([a["name"] for a in authors if "more" not in a.get("name", "")])
        abstract = reconstruct_abstract(item.get("abstract_inverted_index"))

        rows.append({
            "Title": item.get("title"),
            "Authors": author_str,
            "Year": item.get("publication_year"),
            "Journal": journal_name,
            "Publisher": publisher_name,
            "Citations": item.get("cited_by_count"),
            "Open Access": item.get("open_access", {}).get("is_oa", False),
            "DOI": item.get("doi"),
            "Type": item.get("type", ""),
            "Abstract": abstract[:500] if abstract else "",
        })

    df = pd.DataFrame(rows)
    output = io.BytesIO()
    df.to_excel(output, index=False, engine="openpyxl")
    output.seek(0)

    safe_topic = topic.replace(" ", "_")[:30]
    filename = f"research_{safe_topic}_{start_year}_{end_year}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ---------------------------
# Trending Topics
# ---------------------------

@app.get("/trending")
@limiter.limit(RATE_LIMIT_SEARCH)
def get_trending(
    request: Request,
    field: str = Query("computer-science", description="Field of study"),
):
    try:
        params = {
            **get_openalex_params(),
            "filter": f"concepts.display_name.search:{field}",
            "group_by": "publication_year",
            "per_page": 10,
        }
        response = requests.get(WORKS_URL, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return {"field": field, "data": data.get("group_by", [])}
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))


# ---------------------------
# Health Check
# ---------------------------

@app.get("/health")
@limiter.limit("60/minute")
def health_check(request: Request):
    provider = get_active_llm_provider()
    ollama_ok = check_ollama_available()
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": APP_ENV,
        "ai_enabled": provider is not None,
        "ai_provider": provider or "none",
        "ollama_available": ollama_ok,
        "ollama_model": OLLAMA_MODEL if ollama_ok else None,
        "openai_configured": bool(OPENAI_API_KEY),
        "scopus_enabled": bool(SCOPUS_API_KEY),
        "data_source": "OpenAlex (260M+ scholarly works)"
    }


# ---------------------------
# Run Directly
# ---------------------------

if __name__ == "__main__":
    import uvicorn
    host = "0.0.0.0" if IS_PROD else "127.0.0.1"
    port = int(os.getenv("PORT", "9999"))
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=not IS_PROD,
        access_log=not IS_PROD,
        workers=1,  # Ollama needs sequential access
    )
