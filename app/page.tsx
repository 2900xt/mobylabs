"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, FileText, Calendar, Users, ExternalLink, Loader2 } from "lucide-react";

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

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch("/api/papers/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          abstract: searchQuery,
          matchCount: 10,
          matchThreshold: 0.0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search papers");
      }

      const data = await response.json();
      setResults(data.papers || []);
    } catch (err) {
      setError("An error occurred while searching. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Get first name from Google OAuth metadata
  const metadata = user.user_metadata || {};
  const fullName = metadata.full_name || metadata.name || "";
  const firstName = fullName.split(" ")[0] || "Researcher";

  return (
    <div className="min-h-screen bg-slate-950 pt-16">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {firstName}
          </h1>
          <p className="text-white/60">
            Search for related research papers by entering an abstract below.
          </p>
        </div>

        {/* Search Section */}
        <div className="mb-8">
          <div className="bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6">
            <label htmlFor="abstract-input" className="block text-sm font-medium text-white/80 mb-3">
              Enter an abstract to find similar papers
            </label>
            <textarea
              id="abstract-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste or type a research abstract here..."
              className="w-full h-40 px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none transition-all"
            />
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-white/40">
                Press Enter or click Search to find related papers
              </p>
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/25 disabled:shadow-none"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Results Section */}
        {hasSearched && !isSearching && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {results.length > 0 ? `Found ${results.length} related papers` : "No results found"}
              </h2>
            </div>

            {results.length === 0 && (
              <div className="bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
                <FileText className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">
                  No papers found matching your abstract. Try a different search query.
                </p>
              </div>
            )}

            {results.map((paper, index) => (
              <div
                key={paper.id || index}
                className="bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-cyan-500/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-cyan-500/20 text-cyan-400 text-sm font-medium rounded-full">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-medium text-white line-clamp-2">
                        {paper.title || "Untitled Paper"}
                      </h3>
                    </div>

                    {paper.authors && (
                      <div className="flex items-center gap-2 text-sm text-white/60 mb-2 ml-11">
                        <Users className="w-4 h-4 flex-shrink-0" />
                        <span className="line-clamp-1">{paper.authors}</span>
                      </div>
                    )}

                    {paper.publish_date && (
                      <div className="flex items-center gap-2 text-sm text-white/60 mb-3 ml-11">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span>{new Date(paper.publish_date).toLocaleDateString()}</span>
                        {paper.journal_ref && (
                          <span className="text-white/40">• {paper.journal_ref}</span>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-white/70 line-clamp-3 ml-11">
                      {paper.abstract || "No abstract available."}
                    </p>

                    {paper.doi && (
                      <div className="mt-3 ml-11">
                        <a
                          href={`https://doi.org/${paper.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on DOI
                        </a>
                      </div>
                    )}
                  </div>

                  {paper.similarity !== undefined && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                        {(paper.similarity * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-white/40">similarity</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
