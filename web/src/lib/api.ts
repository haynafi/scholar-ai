import { SearchParams, SearchResponse, HealthResponse, Paper } from "./types";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:9999";
const IS_BROWSER = typeof window !== "undefined";
const IS_DEV = process.env.NODE_ENV === "development";
// In dev, use Next.js proxy to avoid CORS; in prod, call backend directly
const API_BASE = IS_BROWSER && IS_DEV ? "/api/proxy" : BACKEND_URL;

export async function searchPapers(params: SearchParams): Promise<SearchResponse> {
  const query = new URLSearchParams();
  query.set("topic", params.topic);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.page) query.set("page", String(params.page));
  if (params.start_year) query.set("start_year", String(params.start_year));
  if (params.end_year) query.set("end_year", String(params.end_year));
  if (params.open_access_only) query.set("open_access_only", "true");
  if (params.min_citations) query.set("min_citations", String(params.min_citations));
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.type_filter) query.set("type_filter", params.type_filter);
  if (params.author) query.set("author", params.author);

  const res = await fetch(`${API_BASE}/search?${query.toString()}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Search failed" }));
    throw new Error(error.detail || "Search failed");
  }
  return res.json();
}

export async function summarizePaper(
  title: string,
  abstract: string
): Promise<{ summary: string }> {
  const res = await fetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, abstract }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Summary failed" }));
    throw new Error(error.detail || "Summary failed");
  }
  return res.json();
}

export async function getCitation(
  paper: Paper,
  format: "bibtex" | "apa"
): Promise<{ citation: string }> {
  const res = await fetch(`${API_BASE}/cite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper, format }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Citation failed" }));
    throw new Error(error.detail || "Citation failed");
  }
  return res.json();
}

export async function getBatchCitations(
  papers: Paper[],
  format: "bibtex" | "apa"
): Promise<{ citations: string }> {
  const res = await fetch(`${API_BASE}/cite/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ papers, format }),
  });
  if (!res.ok) {
    throw new Error("Batch citation failed");
  }
  return res.json();
}

export async function exportToExcel(params: {
  topic: string;
  start_year?: number;
  end_year?: number;
  open_access_only?: boolean;
  min_citations?: number;
}): Promise<void> {
  const query = new URLSearchParams();
  query.set("topic", params.topic);
  if (params.start_year) query.set("start_year", String(params.start_year));
  if (params.end_year) query.set("end_year", String(params.end_year));
  if (params.open_access_only) query.set("open_access_only", "true");
  if (params.min_citations) query.set("min_citations", String(params.min_citations));

  const res = await fetch(`${API_BASE}/export?${query.toString()}`);
  if (!res.ok) throw new Error("Export failed");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const filename = disposition?.match(/filename=(.+)/)?.[1] || `research_${params.topic.replace(/\s+/g, "_")}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function checkScopus(
  doi: string
): Promise<{ indexed: boolean; scopus_url: string | null; scopus_id: string | null }> {
  const res = await fetch(`${API_BASE}/scopus/check?doi=${encodeURIComponent(doi)}`);
  if (!res.ok) {
    return { indexed: false, scopus_url: null, scopus_id: null };
  }
  return res.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
