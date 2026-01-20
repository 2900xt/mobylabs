"use client";

import Image from "next/image";
import { ProcessStep } from "./types";

interface PearlHeaderProps {
  currentStep: ProcessStep;
}

export default function PearlHeader({ currentStep }: PearlHeaderProps) {
  return (
    <div className="text-center mb-6">
      <div className="flex items-center justify-center gap-2 mb-6">
        <Image src="/logo.png" alt="Moby Labs Logo" width={40} height={40} className="drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
        <span className="text-3xl font-bold bg-gradient-to-r from-slate-100 via-blue-100 to-purple-100 bg-clip-text text-transparent">
          Moby Labs
        </span>
        <span className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer drop-shadow-[0_0_20px_rgba(251,191,36,0.4)]">
          Pearl
        </span>
      </div>

      {currentStep === "idle" && (
        <h1 className="text-2xl font-semibold text-slate-100/90 mb-2 opacity-0 animate-fade-in-up">
          What research idea do you want to explore?
        </h1>
      )}
    </div>
  );
}
