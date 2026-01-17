"use client";
import ScrollingAbstractsBackground from "@/components/ScrollingAbstractsBackground";
import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex flex-col h-screen bg-slate-950 overflow-hidden">
      <ScrollingAbstractsBackground />

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-tight">
          Moby Labs
        </h1>
        <p className="mt-4 text-lg text-white/60 max-w-md">
          Full AI research automation. Parse, search, discover, publish.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/reef"
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg transition-colors"
          >
            Try Reef
          </Link>
          <p className="text-sm text-white/40">
            Most tools still cooking. Reef is live.
          </p>
        </div>
      </div>
    </div>
  );
}