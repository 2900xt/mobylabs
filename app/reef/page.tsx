"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PreSearchView from "@/components/reef/PreSearchView";
import ScrollingAbstractsBackground from "@/components/ScrollingAbstractsBackground";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Redirect to login if not authenticated
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

      const response = await fetch("/api/reef/parse-document", {
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

    try {
      let queryText = extractedText;
      if (searchQuery.trim() && extractedText) {
        queryText = `${searchQuery.trim()}\n\nDocument content:\n${extractedText}`;
      } else if (searchQuery.trim()) {
        queryText = searchQuery.trim();
      }

      const response = await fetch("/api/reef/papers/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abstract: queryText,
          userId: user!.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          setError("Insufficient credits. Please add more credits to continue searching.");
        } else {
          throw new Error(data.error || "Failed to search papers");
        }
        return;
      }

      // Redirect to the search results page
      if (data.searchId) {
        router.push(`/reef/search/${data.searchId}`);
      }
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

  if (!user) return "sign in pls";

  return (
    <div className="relative flex flex-col h-[calc(100vh-2.75rem)] bg-slate-950 overflow-hidden">
      {/* Scrolling abstracts background */}
      <ScrollingAbstractsBackground />

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex overflow-y-auto">
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
      </div>
    </div>
  );
}
