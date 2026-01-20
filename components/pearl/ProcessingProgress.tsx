"use client";

import { Loader2, Search, FileText, Brain, CheckCircle2 } from "lucide-react";
import { ProcessStep, ProgressState } from "./types";

const STEPS = [
  { key: "searching", label: "Finding relevant papers", icon: Search },
  { key: "extracting", label: "Extracting claims & methods", icon: FileText },
  { key: "generating", label: "Generating research angles", icon: Brain },
] as const;

interface ProcessingProgressProps {
  currentStep: ProcessStep;
  progress: ProgressState;
}

export default function ProcessingProgress({
  currentStep,
  progress,
}: ProcessingProgressProps) {
  const progressPercentage =
    currentStep === "searching"
      ? 33
      : currentStep === "extracting"
      ? 66
      : currentStep === "generating"
      ? 90
      : 0;

  return (
    <div className="w-full max-w-2xl animate-fade-in-up">
      <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            <div className="absolute inset-0 w-5 h-5 bg-amber-500/30 rounded-full animate-ping" />
          </div>
          <span className="text-white font-medium">Analyzing your research idea...</span>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          {STEPS.map((step, index) => {
            const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
            const isActive = step.key === currentStep;
            const isCompleted = index < stepIndex;

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 transition-all duration-500 ${
                  isCompleted
                    ? "opacity-100"
                    : isActive
                    ? "opacity-100"
                    : "opacity-40"
                }`}
                style={{
                  transform: isActive ? "translateX(4px)" : "translateX(0)",
                }}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted
                      ? "bg-green-500/20 text-green-400 scale-100"
                      : isActive
                      ? "bg-amber-500/20 text-amber-400 scale-110"
                      : "bg-white/5 text-white/30 scale-100"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 animate-scale-in" />
                  ) : isActive ? (
                    <step.icon className="w-4 h-4 animate-pulse" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm transition-colors duration-300 ${
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
                    <p className="text-xs text-white/50 mt-1 animate-fade-in">
                      Found {progress.papersFound} relevant papers
                    </p>
                  )}
                  {isActive && step.key === "extracting" && (
                    <p className="text-xs text-white/50 mt-1 animate-fade-in">
                      Processing {progress.totalPapers} papers...
                    </p>
                  )}
                </div>
                <div
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    isCompleted
                      ? "bg-green-500"
                      : isActive
                      ? "bg-amber-500 animate-pulse shadow-lg shadow-amber-500/50"
                      : "bg-white/10"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 transition-all duration-700 ease-out relative"
              style={{ width: `${progressPercentage}%` }}
            >
              {/* Shimmer effect on progress bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer-slide" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
