"use client";

import { Search, Sparkles } from "lucide-react";

type Tool = "reef" | "pearl";

interface ToolSelectorProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export default function ToolSelector({ activeTool, onToolChange }: ToolSelectorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      <button
        onClick={() => onToolChange("reef")}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          activeTool === "reef"
            ? "text-cyan-400"
            : "text-white/50 hover:text-white/70"
        }`}
      >
        <Search className="w-4 h-4" />
        Reef
        {activeTool === "reef" && (
          <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-400 rounded-full" />
        )}
      </button>
      <button
        onClick={() => onToolChange("pearl")}
        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
          activeTool === "pearl"
            ? "text-amber-400"
            : "text-white/50 hover:text-white/70"
        }`}
      >
        <Sparkles className="w-4 h-4" />
        Pearl
        {activeTool === "pearl" && (
          <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full" />
        )}
      </button>
    </div>
  );
}
