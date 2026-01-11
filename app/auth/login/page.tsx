"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

// Sample research paper snippets for the background animation
const paperSnippets = [
  "We propose a novel approach to neural network optimization using adaptive gradient methods...",
  "This paper introduces a transformer-based architecture for protein structure prediction...",
  "Our findings demonstrate significant improvements in natural language understanding through...",
  "We present empirical evidence for the effectiveness of contrastive learning in...",
  "The experimental results show that our method outperforms existing baselines on...",
  "In this work, we explore the theoretical foundations of deep reinforcement learning...",
  "We introduce a new benchmark dataset for evaluating multimodal reasoning capabilities...",
  "Our analysis reveals previously unknown relationships between attention mechanisms and...",
  "This study investigates the scaling laws governing large language model performance...",
  "We demonstrate that self-supervised pretraining significantly improves downstream task...",
  "The proposed framework achieves state-of-the-art results on multiple benchmark datasets...",
  "Our theoretical analysis provides new insights into the convergence properties of...",
  "We present a comprehensive survey of recent advances in graph neural networks...",
  "Experimental validation confirms the robustness of our approach across diverse domains...",
  "This paper addresses the fundamental challenge of sample efficiency in deep learning...",
  "We introduce a novel loss function that improves training stability and convergence...",
  "Our method leverages hierarchical representations to capture long-range dependencies...",
  "The results indicate that architectural modifications can significantly reduce compute...",
  "We propose an efficient algorithm for approximate inference in probabilistic models...",
  "This work establishes new theoretical bounds for generalization in overparameterized...",
  "Our empirical study reveals surprising capabilities of smaller language models when...",
  "We demonstrate the effectiveness of curriculum learning strategies for complex tasks...",
  "The proposed attention mechanism enables efficient processing of extremely long sequences...",
  "Our findings challenge conventional assumptions about the role of depth in neural nets...",
];

function ScrollingColumn({ snippets, reverse }: { snippets: string[]; reverse?: boolean }) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => (prev + 1) % 1000);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const translateY = reverse ? offset % 400 : -(offset % 400);

  return (
    <div
      className="flex flex-col gap-3 transition-transform"
      style={{ transform: `translateY(${translateY}px)` }}
    >
      {[...snippets, ...snippets, ...snippets].map((text, i) => (
        <div
          key={i}
          className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded text-white/25 text-xs leading-relaxed font-mono"
        >
          {text}
        </div>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showSignUpTooltip, setShowSignUpTooltip] = useState(false);

  // Redirect if already logged in
  if (!loading && user) {
    router.push("/");
    return null;
  }

  const handleGoogleSignIn = async () => {
    setError("");
    setIsSigningIn(true);

    const { error: signInError } = await signInWithGoogle();

    if (signInError) {
      setError(signInError.message);
      setIsSigningIn(false);
    }
  };

  // Split snippets into columns
  const col1 = paperSnippets.slice(0, 8);
  const col2 = paperSnippets.slice(8, 16);
  const col3 = paperSnippets.slice(16, 24);
  const col4 = [...paperSnippets.slice(0, 8)];

  return (
    <div className="min-h-screen bg-slate-950 relative flex items-center justify-center overflow-hidden">
      {/* Scrolling abstracts background */}
      <div className="absolute inset-0 flex gap-3 opacity-50 pointer-events-none px-2">
        <div className="flex-1 overflow-hidden">
          <ScrollingColumn snippets={col1} />
        </div>
        <div className="flex-1 overflow-hidden hidden sm:block">
          <ScrollingColumn snippets={col2} reverse />
        </div>
        <div className="flex-1 overflow-hidden hidden md:block">
          <ScrollingColumn snippets={col3} />
        </div>
        <div className="flex-1 overflow-hidden hidden lg:block">
          <ScrollingColumn snippets={col4} reverse />
        </div>
      </div>

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950 pointer-events-none" />

      {/* Sign up hover icon - top right */}
      <div
        className="absolute top-6 right-6 z-20"
        onMouseEnter={() => setShowSignUpTooltip(true)}
        onMouseLeave={() => setShowSignUpTooltip(false)}
      >
        <div className="relative">
          <button className="p-2 text-white/40 hover:text-cyan-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
            </svg>
          </button>
          {showSignUpTooltip && (
            <div className="absolute right-0 top-full mt-2 px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-white text-xs font-medium whitespace-nowrap shadow-xl">
              New here? Sign up with Google
            </div>
          )}
        </div>
      </div>

      {/* Main sign-in card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-8 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
              Reef, by Moby Labs
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Automate your research workflow with AI
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn || loading}
            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium py-3 px-4 rounded-lg hover:from-cyan-400 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isSigningIn ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>{isSigningIn ? "Signing in..." : "Continue with Google"}</span>
          </button>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs">
              By continuing, you agree to our{" "}
              <Link href="https://mobylabs.org/terms" className="text-cyan-400/70 hover:text-cyan-300 transition-colors">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="https://mobylabs.org/privacy" className="text-cyan-400/70 hover:text-cyan-300 transition-colors">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
