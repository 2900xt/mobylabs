"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, FileText } from "lucide-react";

export interface DocSection {
  id: string;
  title: string;
  tool: string;
}

interface DocsSidebarProps {
  sections: DocSection[];
  activeSection: string | null;
  onSectionClick: (id: string) => void;
}

export default function DocsSidebar({ sections, activeSection, onSectionClick }: DocsSidebarProps) {
  // Group sections by tool
  const sectionsByTool = sections.reduce(
    (acc, section) => {
      if (!acc[section.tool]) {
        acc[section.tool] = [];
      }
      acc[section.tool].push(section);
      return acc;
    },
    {} as Record<string, DocSection[]>
  );

  return (
    <div className="fixed left-0 top-11 bottom-0 w-64 bg-slate-900 border-r border-white/10 flex flex-col">
      {/* Navigation Links */}
      <div className="px-3 pb-2">
        <Link
          href="/"
          className="group flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Home className="w-3.5 h-3.5 text-white/70" />
          </div>
          <span className="text-sm text-white/70 group-hover:text-white/90">Home</span>
        </Link>
      </div>

      {/* Sections Navigation */}
      <div className="flex-1 overflow-y-auto px-3">
        {Object.entries(sectionsByTool).map(([tool, toolSections]) => (
          <div key={tool} className="mb-4">
            <div className="text-xs font-medium text-white/40 px-3 py-2 uppercase tracking-wider">
              {tool}
            </div>
            <div className="space-y-0.5">
              {toolSections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => onSectionClick(section.id)}
                    className={`relative block w-full text-left px-3 py-2 rounded-md transition-all group ${
                      isActive ? "bg-cyan-500/15 border border-cyan-500/30" : "hover:bg-white/5"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
                    )}
                    <div className="flex items-center gap-2">
                      <FileText
                        className={`w-3.5 h-3.5 ${isActive ? "text-cyan-400" : "text-white/40"}`}
                      />
                      <p
                        className={`text-sm truncate transition-colors ${
                          isActive
                            ? "text-cyan-200 font-medium"
                            : "text-white/70 group-hover:text-white"
                        }`}
                      >
                        {section.title}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
