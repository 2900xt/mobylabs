"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import ScrollingAbstractsBackground from "@/components/ScrollingAbstractsBackground";
import ToolSelector from "@/components/ToolSelector";
import SearchBar from "@/components/reef/SearchBar";
import {
  ResearchInput,
  ProcessingProgress,
  ResultsSection,
  ProcessStep,
  ProgressState,
  ResultsState,
  PaperAnalysis,
} from "@/components/pearl";

type Tool = "reef" | "pearl";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTool, setActiveTool] = useState<Tool>("pearl");

  // Sync tool from URL param
  useEffect(() => {
    const toolParam = searchParams.get("tool");
    if (toolParam === "reef" || toolParam === "pearl") {
      setActiveTool(toolParam);
    }
  }, [searchParams]);

  // Reef state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [reefError, setReefError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [isParsingFile, setIsParsingFile] = useState(false);

  // Pearl state
  const [researchIdea, setResearchIdea] = useState("");
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle");
  const [pearlError, setPearlError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    papersFound: 0,
    papersProcessed: 0,
    totalPapers: 0,
  });
  const [results, setResults] = useState<ResultsState | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/login");
    }
  }, [user, loading, router]);

  // Reef handlers
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsParsingFile(true);
    setReefError(null);

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
      setReefError(err instanceof Error ? err.message : "Failed to parse document");
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
    setReefError(null);

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
          setReefError("Insufficient credits. Please add more credits to continue searching.");
        } else {
          throw new Error(data.error || "Failed to search papers");
        }
        return;
      }

      if (data.searchId) {
        window.location.href = `/reef/search/${data.searchId}`;
      }
    } catch (err) {
      setReefError("An error occurred while searching. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Pearl handlers
  const handlePearlSubmit = async () => {
    if (!researchIdea.trim() || researchIdea.trim().length < 20) {
      setPearlError("Please describe your research idea in at least 20 characters.");
      return;
    }

    setPearlError(null);
    setResults(null);
    setCurrentStep("searching");
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });

    try {
      const searchResponse = await fetch("/api/reef/papers/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user!.id,
          abstract: researchIdea.trim(),
        }),
      });

      if (!searchResponse.ok) {
        const data = await searchResponse.json();
        if (searchResponse.status === 402) {
          throw new Error("Insufficient credits. Please add more credits to continue.");
        }
        throw new Error(data.error || "Failed to create search");
      }

      const { searchId } = await searchResponse.json();

      const resultsResponse = await fetch(`/api/reef/search/${searchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id }),
      });

      if (!resultsResponse.ok) {
        const data = await resultsResponse.json();
        throw new Error(data.error || "Failed to fetch search results");
      }

      const searchData = await resultsResponse.json();
      const arxivIds = searchData.papers.slice(0, 5).map((p: { arxiv_id: string }) => p.arxiv_id);

      if (arxivIds.length === 0) {
        throw new Error("No relevant papers found. Try a different research idea.");
      }

      setProgress({ papersFound: arxivIds.length, papersProcessed: 0, totalPapers: arxivIds.length });

      setCurrentStep("extracting");

      const extractResponse = await fetch("/api/pearl/extract-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arxiv_ids: arxivIds,
          userId: user!.id,
        }),
      });

      if (!extractResponse.ok) {
        const data = await extractResponse.json();
        throw new Error(data.error || "Failed to extract claims from papers");
      }

      const extractData = await extractResponse.json();
      const papers: PaperAnalysis[] = extractData.papers;

      if (papers.length === 0) {
        throw new Error("Could not extract information from papers. Please try again.");
      }

      setProgress((prev) => ({ ...prev, papersProcessed: papers.length }));

      setCurrentStep("generating");

      const anglesResponse = await fetch("/api/pearl/gen-angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user!.id,
          researchIdea: researchIdea.trim(),
          papers,
        }),
      });

      if (!anglesResponse.ok) {
        const data = await anglesResponse.json();
        throw new Error(data.error || "Failed to generate research angles");
      }

      const anglesData = await anglesResponse.json();

      setResults({
        angles: anglesData.angles,
        analyzedPapers: anglesData.analyzedPapers,
        searchId,
      });
      setCurrentStep("complete");
    } catch (err) {
      console.error("Pearl error:", err);
      setPearlError(err instanceof Error ? err.message : "An unexpected error occurred");
      setCurrentStep("error");
    }
  };

  const resetPearlForm = () => {
    setCurrentStep("idle");
    setResults(null);
    setPearlError(null);
    setResearchIdea("");
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });
  };

  const startWithNewIdea = (newIdea: string) => {
    setCurrentStep("idle");
    setResults(null);
    setPearlError(null);
    setResearchIdea(newIdea);
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500" />
          <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border border-cyan-500/30" />
        </div>
      </div>
    );
  }

  if (!user) return "sign in pls";

  const isProcessing = ["searching", "extracting", "generating"].includes(currentStep);

  return (
    <div className="relative flex flex-col h-[calc(100vh-2.75rem)] bg-slate-950 overflow-hidden">
      <ScrollingAbstractsBackground />

      <div className="relative z-10 flex-1 flex flex-col overflow-y-auto">
        <div className="flex flex-col items-center justify-center flex-1 px-4 py-8">
          {/* Header */}
          <div className="text-center mb-4 opacity-0 animate-fade-in-up">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Image src="/logo.png" alt="Moby Labs Logo" width={40} height={40} />
              <span className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Moby Labs
              </span>
            </div>
          </div>

          {/* Tool Selector */}
          <div className="opacity-0 animate-fade-in-up animation-delay-100">
            <ToolSelector
              activeTool={activeTool}
              onToolChange={(tool) => {
                setActiveTool(tool);
                router.replace(`/?tool=${tool}`, { scroll: false });
              }}
            />
          </div>

          {/* Reef Content */}
          {activeTool === "reef" && (
            <div className="w-full max-w-2xl opacity-0 animate-fade-in-up animation-delay-200">
              <h1 className="text-xl font-semibold text-white mb-4 text-center">
                What paper are you looking for?
              </h1>

              {reefError && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {reefError}
                </div>
              )}

              <SearchBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSearch={handleSearch}
                isSearching={isSearching}
                onFileSelect={handleFileSelect}
                onFileClear={clearFile}
                selectedFile={selectedFile}
                isParsingFile={isParsingFile}
                extractedText={extractedText}
              />
            </div>
          )}

          {/* Pearl Content */}
          {activeTool === "pearl" && (
            <>
              <h1 className="text-xl font-semibold text-white mb-4 text-center opacity-0 animate-fade-in-up animation-delay-150">
                {currentStep === "idle" || currentStep === "error"
                  ? "Describe your research idea"
                  : currentStep === "complete"
                  ? "Research angles generated"
                  : "Analyzing papers..."}
              </h1>

              {(currentStep === "idle" || currentStep === "error") && (
                <ResearchInput
                  value={researchIdea}
                  onChange={setResearchIdea}
                  onSubmit={handlePearlSubmit}
                  error={pearlError}
                />
              )}

              {isProcessing && (
                <div className="opacity-0 animate-fade-in-up animation-delay-200">
                  <ProcessingProgress currentStep={currentStep} progress={progress} />
                </div>
              )}

              {currentStep === "complete" && results && (
                <ResultsSection
                  results={results}
                  onReset={resetPearlForm}
                  userId={user!.id}
                  userIdea={researchIdea}
                  onIterate={startWithNewIdea}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
