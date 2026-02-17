"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  X,
  Download,
  Lock,
  Unlock,
  CalendarRange,
} from "lucide-react";
import { useState } from "react";

interface SearchFiltersProps {
  onSearch: (params: {
    topic: string;
    start_year?: number;
    end_year?: number;
    open_access_only?: boolean;
    min_citations?: number;
    sort_by?: string;
    type_filter?: string;
    author?: string;
  }) => void;
  onExport: () => void;
  loading: boolean;
}

export function SearchFilters({ onSearch, onExport, loading }: SearchFiltersProps) {
  const [topic, setTopic] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [openAccessOnly, setOpenAccessOnly] = useState(false);
  const [minCitations, setMinCitations] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [typeFilter, setTypeFilter] = useState("");
  const [author, setAuthor] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= 1950; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const handleSearch = () => {
    if (!topic.trim()) return;
    onSearch({
      topic: topic.trim(),
      start_year: startYear && startYear !== "any" ? parseInt(startYear) : undefined,
      end_year: endYear && endYear !== "any" ? parseInt(endYear) : undefined,
      open_access_only: openAccessOnly || undefined,
      min_citations: minCitations && minCitations !== "any" ? parseInt(minCitations) : undefined,
      sort_by: sortBy,
      type_filter: typeFilter || undefined,
      author: author.trim() || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearFilters = () => {
    setStartYear("");
    setEndYear("");
    setOpenAccessOnly(false);
    setMinCitations("");
    setSortBy("relevance");
    setTypeFilter("");
    setAuthor("");
  };

  const activeFilterCount = [
    startYear,
    endYear,
    openAccessOnly,
    minCitations,
    sortBy !== "relevance" ? sortBy : "",
    typeFilter,
    author,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main search bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search papers... (e.g., machine learning)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 h-11 text-sm"
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading || !topic.trim()}
          className="h-11 px-6 w-full sm:w-auto"
        >
          {loading ? (
            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onExport}
          disabled={!topic.trim()}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden xs:inline">Export</span> Excel
        </Button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 sm:p-4 rounded-lg border bg-muted/30">
          {/* Start Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CalendarRange className="h-3 w-3" />
              From Year
            </label>
            <Select value={startYear} onValueChange={setStartYear}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={`${currentYear - 5} (default)`} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="any">Any year</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CalendarRange className="h-3 w-3" />
              To Year
            </label>
            <Select value={endYear} onValueChange={setEndYear}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={`${currentYear} (default)`} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                <SelectItem value="any">Any year</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Min citations */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Min Citations</label>
            <Select value={minCitations} onValueChange={setMinCitations}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="5">5+</SelectItem>
                <SelectItem value="10">10+</SelectItem>
                <SelectItem value="25">25+</SelectItem>
                <SelectItem value="50">50+</SelectItem>
                <SelectItem value="100">100+</SelectItem>
                <SelectItem value="500">500+</SelectItem>
                <SelectItem value="1000">1,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sort By</label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Relevance</SelectItem>
                <SelectItem value="citations">Most Cited</SelectItem>
                <SelectItem value="year_desc">Newest First</SelectItem>
                <SelectItem value="year_asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Paper Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="article">Journal Article</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="book-chapter">Book Chapter</SelectItem>
                <SelectItem value="proceedings-article">Conference Paper</SelectItem>
                <SelectItem value="dissertation">Dissertation</SelectItem>
                <SelectItem value="preprint">Preprint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Author */}
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Author</label>
            <Input
              placeholder="Filter by author name..."
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 text-xs"
            />
          </div>

          {/* Open Access */}
          <div className="flex items-end">
            <Button
              variant={openAccessOnly ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs gap-1.5 w-full"
              onClick={() => setOpenAccessOnly(!openAccessOnly)}
            >
              {openAccessOnly ? (
                <Unlock className="h-3.5 w-3.5" />
              ) : (
                <Lock className="h-3.5 w-3.5" />
              )}
              {openAccessOnly ? "Open Access Only" : "All Access"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
