"use client";

import { ResearchAngle } from "./types";

interface ScoreBarProps {
  label: string;
  value: number;
  color: string;
}

function ScoreBar({ label, value, color }: ScoreBarProps) {
  return (
    <div className="bg-white/5 rounded-lg p-3 group hover:bg-white/[0.07] transition-colors duration-300">
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-1000 ease-out`}
            style={{
              width: `${value * 10}%`,
              transitionDelay: "300ms",
            }}
          />
        </div>
        <span className="text-sm text-white font-medium">{value}</span>
      </div>
    </div>
  );
}

interface ResearchAngleCardProps {
  angle: ResearchAngle;
  index: number;
}

export default function ResearchAngleCard({ angle, index }: ResearchAngleCardProps) {
  return (
    <div
      className="bg-slate-800/50 border border-white/10 rounded-xl p-6 hover:border-amber-500/30 transition-all duration-500 hover:shadow-lg hover:shadow-amber-500/5 group opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${index * 150}ms`,
        animationFillMode: "forwards",
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm group-hover:scale-110 group-hover:bg-amber-500/30 transition-all duration-300">
            {index + 1}
          </div>
          <h3 className="text-lg font-semibold text-white group-hover:text-amber-100 transition-colors duration-300">
            {angle.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 bg-amber-500/20 px-2 py-1 rounded text-amber-400 text-sm font-medium group-hover:bg-amber-500/30 transition-colors duration-300">
          <span className="tabular-nums">{angle.overallScore.toFixed(1)}</span>
          <span className="text-amber-500/70">/10</span>
        </div>
      </div>

      <p className="text-white/70 text-sm mb-4 leading-relaxed">{angle.description}</p>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <ScoreBar label="Novelty" value={angle.novelty} color="bg-purple-500" />
        <ScoreBar label="Practicality" value={angle.practicality} color="bg-blue-500" />
        <ScoreBar label="Impact" value={angle.impact} color="bg-green-500" />
      </div>

      {/* Reasoning */}
      <div className="mb-4">
        <p className="text-xs text-white/40 mb-2">Reasoning</p>
        <p className="text-sm text-white/60 leading-relaxed">{angle.reasoning}</p>
      </div>

      {/* Brief Plan */}
      <div className="mb-4">
        <p className="text-xs text-white/40 mb-2">Action Plan</p>
        <ol className="space-y-1">
          {angle.briefPlan.map((step, i) => (
            <li
              key={i}
              className="text-sm text-white/60 flex items-start gap-2 hover:text-white/80 transition-colors duration-200"
            >
              <span className="text-amber-400 font-medium tabular-nums">{i + 1}.</span>
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
                className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white/50 hover:bg-white/10 hover:text-white/70 transition-all duration-200"
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
