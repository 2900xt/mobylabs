"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DeepOceanBackground,
  PearlHeader,
  ResearchInput,
  ProcessingProgress,
  ResultsSection,
  ProcessStep,
  ProgressState,
  ResultsState,
  PaperAnalysis,
} from "@/components/pearl";

export default function PearlPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [researchIdea, setResearchIdea] = useState("");
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle");
  const [error, setError] = useState<string | null>(null);
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

  const handleSubmit = async () => {
    if (!researchIdea.trim() || researchIdea.trim().length < 20) {
      setError("Please describe your research idea in at least 20 characters.");
      return;
    }

    setError(null);
    setResults(null);
    setCurrentStep("searching");
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });

    try {
      // Step 1: Create search and find relevant papers
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

      // Fetch search results
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

      // Step 2: Extract claims from papers
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

      // Step 3: Generate research angles
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
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setCurrentStep("error");
    }
  };

  const resetForm = () => {
    setCurrentStep("idle");
    setResults(null);
    setError(null);
    setResearchIdea("");
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });
  };

  const startWithNewIdea = (newIdea: string) => {
    setCurrentStep("idle");
    setResults(null);
    setError(null);
    setResearchIdea(newIdea);
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
          <div className="absolute inset-0 animate-ping rounded-full h-8 w-8 border border-amber-500/30" />
        </div>
      </div>
    );
  }

  if (!user) return "sign in pls";

  const isProcessing = ["searching", "extracting", "generating"].includes(currentStep);

  return (
    <div className="relative flex flex-col h-screen bg-slate-950 overflow-hidden pt-11">
      <DeepOceanBackground />

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center min-h-full px-4 py-8">
          <PearlHeader currentStep={currentStep} />

          {/* Input Section - shown when idle or error */}
          {(currentStep === "idle" || currentStep === "error") && (
            <ResearchInput
              value={researchIdea}
              onChange={setResearchIdea}
              onSubmit={handleSubmit}
              error={error}
            />
          )}

          {/* Progress Section */}
          {isProcessing && (
            <ProcessingProgress currentStep={currentStep} progress={progress} />
          )}

          {/* Results Section */}
          {currentStep === "complete" && results && (
            <ResultsSection
              results={results}
              onReset={resetForm}
              userId={user!.id}
              userIdea={researchIdea}
              onIterate={startWithNewIdea}
            />
          )}
        </div>
      </div>
    </div>
  );
}
