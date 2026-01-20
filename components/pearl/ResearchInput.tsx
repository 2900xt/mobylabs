"use client";

import { AlertCircle, ArrowUp } from "lucide-react";

interface ResearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error: string | null;
}

export default function ResearchInput({
  value,
  onChange,
  onSubmit,
  error,
}: ResearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-2xl opacity-0 animate-fade-in-up animation-delay-200">
      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2 animate-shake">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="relative group">
        {/* Glow effect behind input */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your research interest or idea. For example: 'I'm interested in exploring how large language models can be used for automated code review...'"
            rows={4}
            className="w-full pl-4 pr-14 py-4 bg-slate-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-slate-800/70 resize-none transition-all duration-300"
            style={{ minHeight: "120px", maxHeight: "200px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "120px";
              target.style.height = Math.min(target.scrollHeight, 200) + "px";
            }}
          />

          <div className="absolute right-2 bottom-2">
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="p-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95"
            >
              <ArrowUp className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-white/30 text-xs mt-3 text-center">
        Pearl will find relevant papers and generate novel research angles based on your idea
      </p>
    </div>
  );
}
