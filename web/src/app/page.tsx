"use client";

import { useState, useEffect } from "react";
import { SearchFilters } from "@/components/search-filters";
import { PaperCard } from "@/components/paper-card";
import { searchPapers, checkHealth, exportToExcel } from "@/lib/api";
import { Paper, SearchResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap,
  BookOpen,
  Database,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
  Library,
  Github,
} from "lucide-react";

export default function Home() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<Record<string, unknown>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>("none");
  const [scopusEnabled, setScopusEnabled] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchHealth = () => {
      checkHealth()
        .then((h) => {
          console.log("Health check response:", h);
          setAiEnabled(h.ai_enabled);
          setAiProvider(h.ai_provider || "none");
          setScopusEnabled(h.scopus_enabled || false);
        })
        .catch((err) => {
          console.error("Health check failed:", err);
          // Retry once after 3 seconds
          setTimeout(() => {
            checkHealth()
              .then((h) => {
                setAiEnabled(h.ai_enabled);
                setAiProvider(h.ai_provider || "none");
                setScopusEnabled(h.scopus_enabled || false);
              })
              .catch((err2) => console.error("Health check retry failed:", err2));
          }, 3000);
        });
    };
    fetchHealth();
  }, []);

  const handleSearch = async (params: Record<string, unknown>, page = 1) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentParams(params);
    setCurrentPage(page);

    try {
      const data = await searchPapers({
        topic: params.topic as string,
        limit: 10,
        page,
        start_year: params.start_year as number | undefined,
        end_year: params.end_year as number | undefined,
        open_access_only: params.open_access_only as boolean | undefined,
        min_citations: params.min_citations as number | undefined,
        sort_by: params.sort_by as string | undefined,
        type_filter: (params.type_filter === "all" ? undefined : params.type_filter) as string | undefined,
        author: params.author as string | undefined,
      });
      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Search failed. Is the backend running?";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentParams.topic) return;
    setExporting(true);
    try {
      await exportToExcel({
        topic: currentParams.topic as string,
        start_year: currentParams.start_year as number | undefined,
        end_year: currentParams.end_year as number | undefined,
        open_access_only: currentParams.open_access_only as boolean | undefined,
        min_citations: currentParams.min_citations as number | undefined,
      });
    } catch {
      setError("Excel export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    handleSearch(currentParams, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = results
    ? Math.ceil(results.total_found / (results.per_page || 10))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold leading-none">ScholarAI</h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">Academic Research Search</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            {aiEnabled && (
              <Badge variant="secondary" className="text-[10px] gap-1 hidden sm:flex">
                <Sparkles className="h-3 w-3" />
                AI: {aiProvider === "ollama" ? "Ollama (Local)" : "OpenAI"}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] gap-1">
              <Database className="h-3 w-3" />
              <span className="hidden sm:inline">260M+ Works</span>
              <span className="sm:hidden">260M+</span>
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Hero section (before first search) */}
        {!hasSearched && (
          <div className="text-center py-8 sm:py-16 space-y-4 sm:space-y-6">
            <div className="flex justify-center">
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Discover Research That Matters
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto px-2">
                Search 260M+ scholarly works with AI-powered summaries, hybrid ranking,
                and instant citation export. Every result is a real, verified paper.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground max-w-sm sm:max-w-none mx-auto">
              <div className="flex items-center justify-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                <span>Real Papers</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                <span>AI Summaries</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>BibTeX & APA</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Library className="h-4 w-4" />
                <span>260M+ Works</span>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <SearchFilters
          onSearch={handleSearch}
          onExport={handleExport}
          loading={loading}
          exporting={exporting}
        />

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 rounded-lg border border-destructive/50 bg-destructive/5 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Results meta */}
        {results && !loading && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {results.total_found.toLocaleString()} papers
              </span>
              <span className="hidden sm:inline">|</span>
              <span>{results.years_filter}</span>
              <span className="hidden sm:inline">|</span>
              <span>{results.total_journals} journals</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {Math.max(totalPages, 1)}
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-5 rounded-lg border space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Paper results */}
        {results && !loading && (
          <div className="mt-4 space-y-4">
            {results.results.map((paper: Paper, i: number) => (
              <PaperCard
                key={paper.id || i}
                paper={paper}
                index={(currentPage - 1) * (results.per_page || 10) + i}
                aiEnabled={aiEnabled}
                scopusEnabled={scopusEnabled}
              />
            ))}
          </div>
        )}

        {/* No results */}
        {results && !loading && results.results.length === 0 && (
          <div className="mt-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No papers found</p>
            <p className="text-sm">Try different keywords or adjust your filters.</p>
          </div>
        )}

        {/* Pagination */}
        {results && !loading && results.results.length > 0 && (
          <div className="mt-6 sm:mt-8 flex items-center justify-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="gap-1 h-8 px-2 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <div className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-3">
              {Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                }
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="gap-1 h-8 px-2 sm:px-3"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 sm:mt-16">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] sm:text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <a
              href="https://github.com/haynafi/scholar-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
            </a>
            <GraduationCap className="h-3.5 w-3.5" />
            ScholarAI v2.0 - Powered by OpenAlex
          </div>
          
        </div>
      </footer>
    </div>
  );
}
