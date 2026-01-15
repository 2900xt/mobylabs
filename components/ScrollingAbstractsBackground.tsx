"use client";

import { useState, useEffect } from "react";

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

  const translateY = reverse ? (offset % 400) - 400 : -(offset % 400);

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

export default function ScrollingAbstractsBackground() {
  // Split snippets into columns
  const col1 = paperSnippets.slice(0, 16);
  const col2 = paperSnippets.slice(8, 24);
  const col3 = paperSnippets.slice(16, 24).concat(paperSnippets.slice(0, 8));
  const col4 = [...paperSnippets.slice(0, 16)].reverse();

  return (
    <>
      {/* Scrolling abstracts background */}
      <div className="absolute inset-0 flex gap-3 opacity-100 pointer-events-none px-2">
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
    </>
  );
}
