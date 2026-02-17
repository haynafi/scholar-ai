# ScholarAI — Academic Research Search Engine

<p align="center">
  <strong>AI-enhanced academic paper discovery with hybrid ranking</strong><br>
  Powered by <a href="https://openalex.org/">OpenAlex</a> (260M+ scholarly works) · Scopus verification · Local AI summaries
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Papers-260M+-blue" alt="Papers">
  <img src="https://img.shields.io/badge/AI-Ollama%20%2F%20Llama-green" alt="AI">
  <img src="https://img.shields.io/badge/Cost-Free-brightgreen" alt="Free">
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT">
</p>

---

## Why ScholarAI?

Large language models like ChatGPT and Gemini often **hallucinate citations** — generating fake paper titles, non-existent DOIs, and fabricated authors. ScholarAI solves this by searching real academic databases directly.

| | ChatGPT / Gemini | Google Scholar | **ScholarAI** |
|---|---|---|---|
| Real papers with DOIs | ❌ Often hallucinated | ✅ | ✅ |
| Live citation counts | ❌ | ✅ | ✅ |
| AI-powered summaries | ✅ (but fake sources) | ❌ | ✅ **(real source + AI)** |
| Scopus indexed badge | ❌ | ❌ | ✅ |
| Citation export (BibTeX/APA) | ❌ Unreliable | ❌ | ✅ Formatted correctly |
| Excel bulk export | ❌ | ❌ | ✅ |
| Advanced filters | ❌ Limited | ❌ Basic | ✅ Year, citations, type, author, OA |
| Hybrid ranking algorithm | ❌ | ❌ Opaque | ✅ Relevance 50% + Citations 30% + Recency 20% |
| Open source & self-hosted | ❌ | ❌ | ✅ |

## Features

- **Hybrid Ranking** — Papers scored by relevance (50%), citation count (30%), and recency (20%)
- **AI Summaries** — Local Llama/Ollama integration (free, private, no API key needed)
- **Scopus Verification** — Shows "Scopus Indexed" badge with direct Scopus links
- **Advanced Filters** — Year range, minimum citations, paper type, author name, open access only
- **Citation Export** — BibTeX and APA format, single paper or batch
- **Excel Export** — Download full search results as `.xlsx`
- **Rate Limiting** — Built-in abuse protection for production deployment
- **Security Headers** — HSTS, X-Frame-Options, XSS protection, CORS hardening

## Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Frontend   │────▶│   Backend (FastAPI)   │────▶│   OpenAlex API  │
│  Next.js    │     │                      │     │   260M+ papers  │
│  Tailwind   │     │  ┌────────────────┐  │     └─────────────────┘
│  shadcn/ui  │     │  │ Ollama (Llama) │  │     ┌─────────────────┐
└─────────────┘     │  │ AI Summaries   │  │────▶│   Scopus API    │
                    │  └────────────────┘  │     │   Verification  │
                    └──────────────────────┘     └─────────────────┘
```

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama** (optional, for AI summaries) — [ollama.com](https://ollama.com)

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/scholar-ai.git
cd scholar-ai

# Create environment file
cp .env.example .env
# Edit .env with your settings
```

### 2. Backend

```bash
pip install -r requirements.txt
python main.py
```

API runs at `http://localhost:9999` · Docs at `http://localhost:9999/docs`

### 3. Frontend

```bash
cd web
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`

### 4. AI Summaries (Optional)

```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.1
```

The backend auto-detects Ollama and enables AI summaries — no configuration needed.

## Configuration

Copy `.env.example` to `.env` and customize:

| Variable | Description | Default |
|---|---|---|
| `APP_ENV` | `development` or `production` | `development` |
| `LLM_PROVIDER` | `auto`, `ollama`, or `openai` | `auto` |
| `OLLAMA_MODEL` | Ollama model name | `llama3.2` |
| `SCOPUS_API_KEY` | Free key from [dev.elsevier.com](https://dev.elsevier.com) | — |
| `OPENALEX_EMAIL` | Email for faster API rate limits | — |
| `CORS_ORIGINS` | Allowed frontend origins | `*` |

See `.env.example` for all options including rate limits and OpenAI fallback.

## API Endpoints

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `GET` | `/search` | Search papers with hybrid ranking | 30/min |
| `GET` | `/scopus/check` | Check Scopus indexing by DOI | 20/min |
| `POST` | `/summarize` | AI paper summary (Ollama/OpenAI) | 10/min |
| `POST` | `/cite` | Generate BibTeX or APA citation | 30/min |
| `POST` | `/cite/batch` | Batch citation export | 5/min |
| `GET` | `/export` | Export results to Excel (.xlsx) | 5/min |
| `GET` | `/trending` | Publication trends by field | 30/min |
| `GET` | `/health` | System status & feature availability | 60/min |

## Tech Stack

- **Backend**: Python 3, FastAPI, slowapi (rate limiting)
- **Frontend**: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons
- **AI**: Ollama + Llama 3 (local, free) · OpenAI (optional fallback)
- **Data**: OpenAlex API (260M+ works) · Scopus API (indexing verification)

## Production Deployment

For production, set in `.env`:

```env
APP_ENV=production
CORS_ORIGINS=https://your-domain.com
```

Production mode enables:
- Security headers (HSTS, X-Frame-Options, CSP)
- API docs hidden
- Binds to `0.0.0.0` for reverse proxy / tunnel access
- Structured logging with request timing

## Data Sources & Credibility

All paper metadata comes from **[OpenAlex](https://openalex.org/)** — a free, open catalog of 260M+ scholarly works maintained by a nonprofit. Data is sourced from Crossref, PubMed, DOAJ, and publisher feeds. Every paper has a verifiable DOI.

AI summaries are the only generated content and are clearly labeled. Paper metadata is never hallucinated.

> **Citation**: Priem, J., Piwowar, H., & Orr, R. (2022). OpenAlex: A fully-open index of scholarly works, authors, venues, institutions, and concepts. *ArXiv*. https://arxiv.org/abs/2205.01833

## License

MIT — free for academic and commercial use.
