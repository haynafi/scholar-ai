export interface Author {
  name: string;
  id: string;
  orcid: string;
}

export interface Concept {
  name: string;
  score: number;
}

export interface Paper {
  id: string;
  title: string;
  year: number;
  authors: Author[];
  journal: string;
  publisher: string;
  citations: number;
  open_access: boolean;
  oa_url: string;
  doi: string;
  abstract: string;
  summary: string;
  concepts: Concept[];
  type: string;
  score: number;
  scopus_search_url: string | null;
}

export interface SearchResponse {
  topic: string;
  years_filter: string;
  total_found: number;
  total_journals: number;
  page: number;
  per_page: number;
  results: Paper[];
}

export interface SearchParams {
  topic: string;
  limit?: number;
  page?: number;
  start_year?: number;
  end_year?: number;
  open_access_only?: boolean;
  min_citations?: number;
  sort_by?: string;
  type_filter?: string;
  author?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  ai_enabled: boolean;
  ai_provider: string;
  ollama_available: boolean;
  ollama_model: string | null;
  openai_configured: boolean;
  scopus_enabled: boolean;
  data_source: string;
}
