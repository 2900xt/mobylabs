"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Lightbulb, Rocket, Zap, ChevronRight, ExternalLink } from "lucide-react";
import { ResultsState, ResearchAngle } from "./types";

interface ResultsSectionProps {
  results: ResultsState;
  onReset: () => void;
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40 w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-700`}
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="text-sm text-white/60 w-5 text-right">{value}</span>
    </div>
  );
}

function AngleDetailPanel({ angle }: { angle: ResearchAngle }) {
  return (
    <div className="space-y-4">
      {/* Title and Score */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-white leading-snug">{angle.title}</h2>
        <div className="flex-shrink-0 px-2.5 py-1 bg-amber-500/20 rounded text-amber-400 text-base font-semibold">
          {angle.overallScore.toFixed(1)}/10
        </div>
      </div>

      <p className="text-sm text-white/60 leading-relaxed">{angle.description}</p>

      {/* Scores - compact */}
      <div className="space-y-2 py-3 border-y border-white/5">
        <ScoreBar label="Novelty" value={angle.novelty} color="bg-purple-500" />
        <ScoreBar label="Practicality" value={angle.practicality} color="bg-blue-500" />
        <ScoreBar label="Impact" value={angle.impact} color="bg-green-500" />
      </div>

      {/* Reasoning */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1.5">
          <Lightbulb className="w-3.5 h-3.5" />
          Reasoning
        </div>
        <p className="text-sm text-white/50 leading-relaxed">{angle.reasoning}</p>
      </div>

      {/* Action Plan */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-2">
          <Rocket className="w-3.5 h-3.5" />
          Action Plan
        </div>
        <ol className="space-y-1.5">
          {angle.briefPlan.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-white/50">
              <span className="text-amber-400/70 font-medium">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Limitations */}
      {angle.relatedLimitations.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-2">
            <Zap className="w-3.5 h-3.5" />
            Addresses
          </div>
          <div className="flex flex-wrap gap-1.5">
            {angle.relatedLimitations.map((lim, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-xs text-white/40"
              >
                {lim}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultsSection({ results, onReset }: ResultsSectionProps) {
  const [selectedAngle, setSelectedAngle] = useState<ResearchAngle | null>(
    results.angles.length > 0 ? results.angles[0] : null
  );

  return (
    <div className="w-full h-[calc(100vh-220px)] max-w-6xl opacity-0 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Research Angles</h2>
            <Link
              href={`/reef/search/${results.searchId}`}
              className="text-xs text-white/40 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              {results.angles.length} angles from {results.analyzedPapers} papers
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-sm text-white transition-all hover:border-amber-500/30"
        >
          New Search
        </button>
      </div>

      {/* Split View */}
      <div className="flex h-full rounded-lg overflow-hidden border border-white/10 bg-slate-900/50">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-white/10 overflow-y-auto">
          <div className="p-2">
            <div className="text-xs font-semibold text-white/30 uppercase tracking-wider px-2 mb-2">
              Angles
            </div>
            <div className="space-y-1">
              {results.angles.map((angle, index) => {
                const isSelected = selectedAngle?.title === angle.title;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedAngle(angle)}
                    className={`w-full text-left group relative rounded p-2.5 transition-all duration-150 ${
                      isSelected
                        ? "bg-amber-500/15 border border-amber-500/30"
                        : "bg-slate-800/30 border border-transparent hover:border-white/10 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${
                          isSelected
                            ? "bg-amber-500/30 text-amber-300"
                            : "bg-white/5 text-white/40"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`text-sm font-medium leading-snug line-clamp-2 ${
                            isSelected ? "text-white" : "text-white/70"
                          }`}
                        >
                          {angle.title}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-xs font-medium ${
                              isSelected ? "text-amber-400" : "text-white/30"
                            }`}
                          >
                            {angle.overallScore.toFixed(1)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/60" />
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            {selectedAngle ? (
              <AngleDetailPanel angle={selectedAngle} />
            ) : (
              <div className="flex items-center justify-center h-full text-white/20 text-sm">
                Select an angle
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
