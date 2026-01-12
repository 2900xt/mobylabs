"use client";

import { FileText, Calendar, Users, ExternalLink, Loader2 } from "lucide-react";

interface Paper {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  publish_date: string;
  doi: string | null;
  journal_ref: string | null;
  similarity: number;
}

interface PostSearchViewProps {
  results: Paper[];
  isSearching: boolean;
  error: string | null;
}

export default function PostSearchView({
  results,
  isSearching,
  error,
}: PostSearchViewProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {isSearching ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          <span className="ml-2 text-white/60">Searching papers...</span>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No papers found. Try a different abstract.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-white/40 mb-4">Found {results.length} related papers</p>
          {results.map((paper, index) => (
            <div
              key={paper.id || index}
              className="bg-slate-900/40 border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-cyan-500/10 text-cyan-400 text-xs font-medium rounded-full">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-medium text-white leading-snug">
                      {paper.title || "Untitled Paper"}
                    </h3>
                    {paper.similarity !== undefined && (
                      <span className="flex-shrink-0 text-xs font-medium text-cyan-400">
                        {(paper.similarity * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-white/40">
                    {paper.authors && (
                      <span className="flex items-center gap-1 truncate max-w-[200px]">
                        <Users className="w-3 h-3" />
                        {paper.authors}
                      </span>
                    )}
                    {paper.publish_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(paper.publish_date).getFullYear()}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/50 mt-2 line-clamp-2 leading-relaxed">
                    {paper.abstract || "No abstract available."}
                  </p>

                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      DOI
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
