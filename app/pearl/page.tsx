"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import ScrollingAbstractsBackground from "@/components/ScrollingAbstractsBackground";
import { Loader2, ArrowUp, Sparkles, FileText, Search, Brain, CheckCircle2, AlertCircle } from "lucide-react";

interface PaperAnalysis {
  arxiv_id: string | null;
  claims: string[];
  methods: string[];
  limitations: string[];
  conclusion: string;
}

interface ResearchAngle {
  title: string;
  description: string;
  novelty: number;
  practicality: number;
  impact: number;
  overallScore: number;
  reasoning: string;
  briefPlan: string[];
  relatedLimitations: string[];
}

type ProcessStep = "idle" | "searching" | "extracting" | "generating" | "complete" | "error";

const STEPS = [
  { key: "searching", label: "Finding relevant papers", icon: Search },
  { key: "extracting", label: "Extracting claims & methods", icon: FileText },
  { key: "generating", label: "Generating research angles", icon: Brain },
];

export default function PearlPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [researchIdea, setResearchIdea] = useState("");
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({
    papersFound: 0,
    papersProcessed: 0,
    totalPapers: 0,
  });
  const [results, setResults] = useState<{
    angles: ResearchAngle[];
    analyzedPapers: number;
  } | null>(null);

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

      setProgress(prev => ({ ...prev, papersProcessed: papers.length }));

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
      });
      setCurrentStep("complete");
    } catch (err) {
      console.error("Pearl error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setCurrentStep("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const resetForm = () => {
    setCurrentStep("idle");
    setResults(null);
    setError(null);
    setResearchIdea("");
    setProgress({ papersFound: 0, papersProcessed: 0, totalPapers: 0 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!user) return "sign in pls";

  const isProcessing = ["searching", "extracting", "generating"].includes(currentStep);

  return (
    <div className="relative flex flex-col h-screen bg-slate-950 overflow-hidden pt-11">
      <ScrollingAbstractsBackground />

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center min-h-full px-4 py-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Image src="/logo.png" alt="Moby Labs Logo" width={40} height={40} />
              <span className="text-3xl font-bold bg-gradient-to-r from-white to-amber-200 bg-clip-text text-transparent">
                Moby Labs
              </span>
              <span className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-amber-500 bg-clip-text text-transparent">
                Pearl
              </span>
            </div>

            {currentStep === "idle" && (
              <h1 className="text-2xl font-semibold text-white mb-2">
                What research idea do you want to explore?
              </h1>
            )}
          </div>

          {/* Input Section - shown when idle or error */}
          {(currentStep === "idle" || currentStep === "error") && (
            <div className="w-full max-w-2xl">
              {error && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="relative">
                <textarea
                  value={researchIdea}
                  onChange={(e) => setResearchIdea(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your research interest or idea. For example: 'I'm interested in exploring how large language models can be used for automated code review...'"
                  rows={4}
                  className="w-full pl-4 pr-14 py-4 bg-slate-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
                  style={{ minHeight: "120px", maxHeight: "200px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "120px";
                    target.style.height = Math.min(target.scrollHeight, 200) + "px";
                  }}
                />

                <div className="absolute right-2 bottom-2">
                  <button
                    onClick={handleSubmit}
                    disabled={!researchIdea.trim()}
                    className="p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <ArrowUp className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              <p className="text-white/30 text-xs mt-3 text-center">
                Pearl will find relevant papers and generate novel research angles based on your idea
              </p>
            </div>
          )}

          {/* Progress Section */}
          {isProcessing && (
            <div className="w-full max-w-2xl">
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                  <span className="text-white font-medium">Analyzing your research idea...</span>
                </div>

                {/* Progress Steps */}
                <div className="space-y-4">
                  {STEPS.map((step, index) => {
                    const stepIndex = STEPS.findIndex(s => s.key === currentStep);
                    const isActive = step.key === currentStep;
                    const isCompleted = index < stepIndex;
                    const isPending = index > stepIndex;

                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            isCompleted
                              ? "bg-green-500/20 text-green-400"
                              : isActive
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-white/5 text-white/30"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isActive ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <step.icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p
                            className={`text-sm ${
                              isCompleted
                                ? "text-green-400"
                                : isActive
                                ? "text-white"
                                : "text-white/40"
                            }`}
                          >
                            {step.label}
                          </p>
                          {isActive && step.key === "searching" && progress.papersFound > 0 && (
                            <p className="text-xs text-white/50 mt-1">
                              Found {progress.papersFound} relevant papers
                            </p>
                          )}
                          {isActive && step.key === "extracting" && (
                            <p className="text-xs text-white/50 mt-1">
                              Processing {progress.totalPapers} papers...
                            </p>
                          )}
                        </div>
                        {!isPending && (
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isCompleted ? "bg-green-500" : isActive ? "bg-amber-500 animate-pulse" : "bg-white/10"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                      style={{
                        width:
                          currentStep === "searching"
                            ? "33%"
                            : currentStep === "extracting"
                            ? "66%"
                            : currentStep === "generating"
                            ? "90%"
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          {currentStep === "complete" && results && (
            <div className="w-full max-w-4xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Research Angles Generated</h2>
                    <p className="text-sm text-white/50">Based on {results.analyzedPapers} analyzed papers</p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-sm text-white transition-colors"
                >
                  New Search
                </button>
              </div>

              <div className="space-y-4">
                {results.angles.map((angle, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/50 border border-white/10 rounded-xl p-6 hover:border-amber-500/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                          {index + 1}
                        </div>
                        <h3 className="text-lg font-semibold text-white">{angle.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded text-amber-400 text-sm font-medium">
                        {angle.overallScore.toFixed(1)}/10
                      </div>
                    </div>

                    <p className="text-white/70 text-sm mb-4">{angle.description}</p>

                    {/* Scores */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-white/40 mb-1">Novelty</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${angle.novelty * 10}%` }}
                            />
                          </div>
                          <span className="text-sm text-white font-medium">{angle.novelty}</span>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-white/40 mb-1">Practicality</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${angle.practicality * 10}%` }}
                            />
                          </div>
                          <span className="text-sm text-white font-medium">{angle.practicality}</span>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <p className="text-xs text-white/40 mb-1">Impact</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${angle.impact * 10}%` }}
                            />
                          </div>
                          <span className="text-sm text-white font-medium">{angle.impact}</span>
                        </div>
                      </div>
                    </div>

                    {/* Reasoning */}
                    <div className="mb-4">
                      <p className="text-xs text-white/40 mb-2">Reasoning</p>
                      <p className="text-sm text-white/60">{angle.reasoning}</p>
                    </div>

                    {/* Brief Plan */}
                    <div className="mb-4">
                      <p className="text-xs text-white/40 mb-2">Action Plan</p>
                      <ol className="space-y-1">
                        {angle.briefPlan.map((step, i) => (
                          <li key={i} className="text-sm text-white/60 flex items-start gap-2">
                            <span className="text-amber-400 font-medium">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Related Limitations */}
                    {angle.relatedLimitations.length > 0 && (
                      <div>
                        <p className="text-xs text-white/40 mb-2">Addresses Limitations</p>
                        <div className="flex flex-wrap gap-2">
                          {angle.relatedLimitations.map((lim, i) => (
                            <span
                              key={i}
                              className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/50"
                            >
                              {lim}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}