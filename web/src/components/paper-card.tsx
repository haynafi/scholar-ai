"use client";

import { useState, useEffect } from "react";
import { Paper } from "@/lib/types";
import { summarizePaper, getCitation, checkScopus } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Quote,
  Sparkles,
  Copy,
  Check,
  BookOpen,
  Users,
  Calendar,
  Award,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PaperCardProps {
  paper: Paper;
  index: number;
  aiEnabled: boolean;
  scopusEnabled?: boolean;
}

export function PaperCard({ paper, index, aiEnabled, scopusEnabled }: PaperCardProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [citation, setCitation] = useState<string | null>(null);
  const [citationFormat, setCitationFormat] = useState<"bibtex" | "apa">("bibtex");
  const [showCitation, setShowCitation] = useState(false);
  const [loadingCitation, setLoadingCitation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [scopusIndexed, setScopusIndexed] = useState<boolean | null>(null);
  const [scopusUrl, setScopusUrl] = useState<string | null>(null);

  useEffect(() => {
    if (scopusEnabled && paper.doi) {
      checkScopus(paper.doi)
        .then((res) => {
          setScopusIndexed(res.indexed);
          if (res.scopus_url) setScopusUrl(res.scopus_url);
        })
        .catch(() => {});
    }
  }, [scopusEnabled, paper.doi]);

  const handleSummarize = async () => {
    if (aiSummary) {
      setAiSummary(null);
      return;
    }
    setLoadingSummary(true);
    try {
      const res = await summarizePaper(paper.title, paper.abstract);
      setAiSummary(res.summary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate summary";
      setAiSummary(`Error: ${message}`);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleCite = async (format: "bibtex" | "apa") => {
    setCitationFormat(format);
    setShowCitation(true);
    setLoadingCitation(true);
    try {
      const res = await getCitation(paper, format);
      setCitation(res.citation);
    } catch {
      setCitation("Failed to generate citation.");
    } finally {
      setLoadingCitation(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const authorNames = paper.authors
    .map((a) => a.name)
    .join(", ");

  return (
    <Card className="group transition-all duration-200 hover:shadow-md border-border/60">
      <CardContent className="p-3 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                #{index + 1}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {paper.open_access && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                    Open Access
                  </Badge>
                )}
                {scopusIndexed && (
                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 text-[10px] px-1.5 py-0">
                    Scopus Indexed
                  </Badge>
                )}
                {paper.type && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {paper.type}
                  </Badge>
                )}
              </div>
            </div>

            <h3 className="text-sm sm:text-base font-semibold leading-snug mb-2">
              {paper.doi ? (
                <a
                  href={paper.doi}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  {paper.title}
                  <ExternalLink className="inline ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ) : (
                paper.title
              )}
            </h3>

            {/* Authors */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{authorNames || "Unknown authors"}</span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {paper.journal}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {paper.year}
              </span>
              <span className="flex items-center gap-1">
                <Award className="h-3.5 w-3.5" />
                {paper.citations.toLocaleString()} citations
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono hidden sm:inline">
                Score: {paper.score}
              </span>
            </div>
          </div>
        </div>

        {/* Abstract snippet */}
        <div className="mt-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {expanded ? paper.abstract || paper.summary : paper.summary}
          </p>
          {paper.abstract && paper.abstract.length > paper.summary.length && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary hover:underline mt-1 flex items-center gap-0.5"
            >
              {expanded ? (
                <>Show less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Read full abstract <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>

        {/* Concepts */}
        {paper.concepts.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {paper.concepts.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-normal">
                {c.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-border/50">
          {aiEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleSummarize}
              disabled={loadingSummary}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {loadingSummary ? "Summarizing..." : aiSummary ? "Hide AI Summary" : "AI Summary"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => handleCite("bibtex")}
          >
            <Quote className="h-3.5 w-3.5" />
            BibTeX
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => handleCite("apa")}
          >
            <Quote className="h-3.5 w-3.5" />
            APA
          </Button>

          {paper.oa_url && (
            <a href={paper.oa_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Read PDF
              </Button>
            </a>
          )}

          {(scopusUrl || paper.scopus_search_url) && (
            <a
              href={scopusUrl || paper.scopus_search_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                View on Scopus
              </Button>
            </a>
          )}
        </div>

        {/* AI Summary */}
        {loadingSummary && (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}
        {aiSummary && !loadingSummary && (
          <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">AI Summary</span>
            </div>
            <p className="text-sm leading-relaxed">{aiSummary}</p>
          </div>
        )}

        {/* Citation */}
        {showCitation && (
          <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">
                {citationFormat.toUpperCase()} Citation
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => citation && copyToClipboard(citation)}
              >
                {copied ? (
                  <><Check className="h-3 w-3" /> Copied</>
                ) : (
                  <><Copy className="h-3 w-3" /> Copy</>
                )}
              </Button>
            </div>
            {loadingCitation ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-background p-2 rounded border">
                {citation}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
