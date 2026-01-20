"use client";

import { Sparkles } from "lucide-react";
import { ResultsState } from "./types";
import ResearchAngleCard from "./ResearchAngleCard";

interface ResultsSectionProps {
  results: ResultsState;
  onReset: () => void;
}

export default function ResultsSection({ results, onReset }: ResultsSectionProps) {
  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between mb-6 opacity-0 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
            <Sparkles className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Research Angles Generated</h2>
            <p className="text-sm text-white/50">
              Based on {results.analyzedPapers} analyzed papers
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-sm text-white transition-all duration-300 hover:border-amber-500/30 hover:scale-105 active:scale-95"
        >
          New Search
        </button>
      </div>

      <div className="space-y-4">
        {results.angles.map((angle, index) => (
          <ResearchAngleCard key={index} angle={angle} index={index} />
        ))}
      </div>
    </div>
  );
}
