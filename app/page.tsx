"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PreSearchView from "@/components/PreSearchView";
import PostSearchView from "@/components/PostSearchView";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isParsingFile, setIsParsingFile] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsParsingFile(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to parse document");
      }

      setExtractedText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse document");
      setSelectedFile(null);
      setExtractedText("");
    } finally {
      setIsParsingFile(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setExtractedText("");
  };

  const handleSearch = async () => {
    if (!extractedText && !searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      let queryText = extractedText;
      if (searchQuery.trim() && extractedText) {
        queryText = `${searchQuery.trim()}\n\nDocument content:\n${extractedText}`;
      } else if (searchQuery.trim()) {
        queryText = searchQuery.trim();
      }

      const response = await fetch("/api/papers/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract: queryText,
          matchCount: 10,
          matchThreshold: 0.0,
        }),
      });

      if (!response.ok) throw new Error("Failed to search papers");

      const data = await response.json();
      setResults(data.papers || []);
    } catch (err) {
      setError("An error occurred while searching. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative flex flex-col h-screen">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {!hasSearched ? (
          <PreSearchView
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
            onFileSelect={handleFileSelect}
            onFileClear={clearFile}
            selectedFile={selectedFile}
            isParsingFile={isParsingFile}
            extractedText={extractedText}
            error={error}
          />
        ) : (
          <PostSearchView
            results={results}
            isSearching={isSearching}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
