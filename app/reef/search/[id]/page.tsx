"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FileText, Calendar, Users, ExternalLink, Loader2, ChevronDown } from "lucide-react";

interface Paper {
  arxiv_id: string;
  title: string;
  abstract: string;
  authors: string;
  publish_date: string;
  doi: string | null;
  journal_ref: string | null;
  similarity: number;
}

interface SearchRecord {
  id: string;
  user_id: string;
  title: string;
  abstract: string;
  embedding: number[];
  created_at: string;
}

export default function SearchResultsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchId = params?.id as string;
  const [searchRecord, setSearchRecord] = useState<SearchRecord | null>(null);
  const [results, setResults] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPaper, setHoveredPaper] = useState<Paper | null>(null);
  const [leftWidth, setLeftWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showSearchAbstract, setShowSearchAbstract] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && searchId) {
      const abortController = new AbortController();
      fetchSearchResults(abortController.signal);
      return () => abortController.abort();
    }
  }, [user, authLoading, searchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const fetchSearchResults = async (signal?: AbortSignal) => {
    if (!user?.id) {
      setError("User not authenticated");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/reef/search/${searchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch search results');
      }

      const data = await response.json();
      setSearchRecord(data.search);
      setResults(data.papers || []);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Search results error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative flex flex-col h-screen bg-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Split View Container */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* Left Side - Search Results */}
        <div
          className="border-r border-white/10 overflow-y-auto bg-slate-900/30 backdrop-blur-sm"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="px-5 py-5">
            {/* Search Title */}
            {searchRecord && (
              <div className="mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-0.5 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full"></div>
                  <h1 className="text-lg font-bold text-white tracking-tight">
                    {searchRecord.title}
                  </h1>
                </div>
                <div className="flex items-center gap-3 ml-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(searchRecord.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {searchRecord.abstract && (
                    <button
                      onClick={() => setShowSearchAbstract(!showSearchAbstract)}
                      className="flex items-center gap-0.5 text-[10px] text-white/35 hover:text-cyan-400 transition-colors"
                    >
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-200 ${showSearchAbstract ? 'rotate-180' : ''}`}
                      />
                      <span>{showSearchAbstract ? 'Hide' : 'Abstract'}</span>
                    </button>
                  )}
                </div>
                {showSearchAbstract && searchRecord.abstract && (
                  <p className="mt-2 ml-2.5 text-[11px] text-white/50 leading-relaxed border-l-2 border-cyan-500/30 pl-2 py-0.5">
                    {searchRecord.abstract}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                <span className="ml-2 text-white/60">Loading results...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                <span className="ml-2 text-white/60">Loading results...</span>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                    Results
                  </span>
                  <span className="text-xs font-medium text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                    {results.length} papers
                  </span>
                </div>
                <div className="space-y-1.5">
                  {results.map((paper, index) => (
                    <div
                      key={paper.arxiv_id || index}
                      onMouseEnter={() => setHoveredPaper(paper)}
                      className="group relative bg-slate-800/40 border border-white/5 rounded p-2.5 hover:border-cyan-500/40 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-200 cursor-pointer"
                    >
                      {/* Hover indicator */}
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-l opacity-0 group-hover:opacity-100 transition-opacity"></div>

                      <div className="flex items-start gap-2 pl-0.5">
                        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 text-[10px] font-bold rounded border border-cyan-500/20">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[13px] font-semibold text-white leading-snug group-hover:text-cyan-50 transition-colors">
                              {paper.title || "Untitled Paper"}
                            </h3>
                            {paper.similarity !== undefined && (
                              <div className="flex-shrink-0 px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/25 rounded text-[10px] font-bold text-cyan-400">
                                {(paper.similarity * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {paper.authors && (
                              <div className="flex items-center gap-1 text-[10px] text-white/50">
                                <Users className="w-3 h-3 text-white/40" />
                                <span className="truncate max-w-[160px] font-medium">
                                  {paper.authors.split(',')[0]}{paper.authors.includes(',') && ' et al.'}
                                </span>
                              </div>
                            )}
                            {paper.publish_date && (
                              <div className="flex items-center gap-1 text-[10px] text-white/50 font-medium">
                                <span>•</span>
                                <span>{new Date(paper.publish_date).getFullYear()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          className="relative w-1 bg-white/5 hover:bg-cyan-500/30 cursor-col-resize group transition-colors flex-shrink-0"
          onMouseDown={() => setIsDragging(true)}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center">
            <div className="w-1 h-12 bg-cyan-500/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>

        {/* Right Side - Paper Details */}
        <div
          className="overflow-y-auto"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <div className="px-6 py-6">
            {hoveredPaper ? (
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <h2 className="text-2xl font-semibold text-white leading-tight">
                    {hoveredPaper.title || "Untitled Paper"}
                  </h2>
                  {hoveredPaper.similarity !== undefined && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                      <span className="text-xs text-white/50">Similarity</span>
                      <span className="text-sm font-semibold text-cyan-400">
                        {(hoveredPaper.similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-3">
                  {hoveredPaper.authors && (
                    <div>
                      <div className="flex items-center gap-2 text-white/50 text-xs font-medium mb-1">
                        <Users className="w-4 h-4" />
                        <span>Authors</span>
                      </div>
                      <p className="text-sm text-white/80">{hoveredPaper.authors}</p>
                    </div>
                  )}

                  {hoveredPaper.publish_date && (
                    <div>
                      <div className="flex items-center gap-2 text-white/50 text-xs font-medium mb-1">
                        <Calendar className="w-4 h-4" />
                        <span>Publication Date</span>
                      </div>
                      <p className="text-sm text-white/80">
                        {new Date(hoveredPaper.publish_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}

                  {hoveredPaper.journal_ref && (
                    <div>
                      <div className="flex items-center gap-2 text-white/50 text-xs font-medium mb-1">
                        <FileText className="w-4 h-4" />
                        <span>Journal Reference</span>
                      </div>
                      <p className="text-sm text-white/80">{hoveredPaper.journal_ref}</p>
                    </div>
                  )}

                  {hoveredPaper.doi && (
                    <div>
                      <div className="flex items-center gap-2 text-white/50 text-xs font-medium mb-1">
                        <ExternalLink className="w-4 h-4" />
                        <span>DOI</span>
                      </div>
                      <a
                        href={`https://doi.org/${hoveredPaper.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {hoveredPaper.doi}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {hoveredPaper.arxiv_id && (
                    <div>
                      <div className="flex items-center gap-2 text-white/50 text-xs font-medium mb-1">
                        <ExternalLink className="w-4 h-4" />
                        <span>Full Text Download</span>
                      </div>
                      <a
                        href={`https://arxiv.org/pdf/${hoveredPaper.arxiv_id}.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        {hoveredPaper.arxiv_id}.pdf
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Abstract */}
                {hoveredPaper.abstract && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-2">Abstract</h3>
                    <p className="text-sm text-white/70 leading-relaxed">
                      {hoveredPaper.abstract}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  <FileText className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30 text-sm">
                    Hover over a paper to see its details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
