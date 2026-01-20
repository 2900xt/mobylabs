"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DocsSidebar, { DocSection } from "@/components/docs/DocsSidebar";
import ApiEndpoint from "@/components/docs/ApiEndpoint";
import InfoCard from "@/components/docs/InfoCard";
import ErrorCodes from "@/components/docs/ErrorCodes";

// Define all documentation sections for the sidebar
const docSections: DocSection[] = [
  { id: "authentication", title: "Authentication", tool: "General" },
  { id: "lifecycle", title: "Search Life Cycle", tool: "General" },
  { id: "papers-new", title: "Create Search", tool: "Reef" },
  { id: "search-id", title: "Get Results", tool: "Reef" },
  { id: "extract-claims", title: "Extract Claims", tool: "Pearl" },
  { id: "gen-angles", title: "Generate Angles", tool: "Pearl" },
  { id: "gen-abstract", title: "Generate Abstract", tool: "Pearl" },
  { id: "error-codes", title: "Error Codes", tool: "General" },
];

// Common error codes used across APIs
const commonErrors = [
  { code: 400, description: "Missing or invalid parameters" },
  { code: 402, description: "Insufficient credits" },
  { code: 404, description: "User or search not found" },
  { code: 500, description: "Internal server error" },
];

export default function DocsPage() {
  const { user } = useAuth();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("papers-new");
  const [activeSection, setActiveSection] = useState<string | null>("authentication");

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const handleSectionClick = (id: string) => {
    setActiveSection(id);
    // If it's an endpoint, expand it
    if (["papers-new", "search-id", "extract-claims", "gen-angles", "gen-abstract"].includes(id)) {
      setExpandedSection(id);
    }
    // Scroll to section
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleToggle = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
    setActiveSection(id);
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex pt-11">
      <DocsSidebar
        sections={docSections}
        activeSection={activeSection}
        onSectionClick={handleSectionClick}
      />

      {/* Main content */}
      <div className="ml-64 flex-1 relative z-10">
        <div className="max-w-2xl mx-auto py-6 px-4 pt-16">
          <div className="mb-5">
            <h1 className="text-lg font-bold text-white">API Documentation</h1>
            <p className="text-xs text-white/40 mt-1">
              Integrate Moby Labs tools into your applications
            </p>
          </div>

          {/* Authentication */}
          <div ref={(el) => { sectionRefs.current["authentication"] = el; }}>
            <InfoCard title="Authentication">
              All requests require a{" "}
              <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded">userId</code> parameter
              in the request body. Your API key is your user ID, found on your{" "}
              <a href="/profile" className="text-cyan-400 hover:underline">
                profile page
              </a>
              .
            </InfoCard>
          </div>

          {/* Life Cycle */}
          <div ref={(el) => { sectionRefs.current["lifecycle"] = el; }}>
            <InfoCard title="Search Life Cycle">
              All requests and stored searches have a life cycle of 3 days. After this period,
              searches and their associated data will be automatically deleted from our servers to
              ensure data privacy and optimal performance.
            </InfoCard>
          </div>

          {/* Error Codes */}
          <div ref={(el) => { sectionRefs.current["error-codes"] = el; }}>
            <ErrorCodes errors={commonErrors} />
          </div>

          {/* Reef API Section Header */}
          <div className="mt-6 mb-3">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Reef API
            </h2>
            <p className="text-xs text-white/40 mt-1">
              Search for similar research papers based on abstracts
            </p>
          </div>

          {/* POST /api/reef/papers/new */}
          <div ref={(el) => { sectionRefs.current["papers-new"] = el; }}>
            <ApiEndpoint
              id="papers-new"
              method="POST"
              path="/api/reef/papers/new"
              description="Create a new search from an abstract. Costs 1 credit."
              requestBody={[
                { name: "userId", type: "string", description: "Your API key" },
                { name: "abstract", type: "string", description: "Paper abstract to search" },
              ]}
              response={[
                { name: "searchId", type: "uuid", nested: undefined },
                { name: "message", type: "Search saved successfully", nested: undefined },
              ]}
              example={`curl -X POST ${baseUrl}/api/reef/papers/new \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "YOUR_API_KEY", "abstract": "..."}'`}
              expandedSection={expandedSection}
              onToggle={handleToggle}
              copiedEndpoint={copiedEndpoint}
              onCopy={copyToClipboard}
            />
          </div>

          {/* POST /api/reef/search/[id] */}
          <div ref={(el) => { sectionRefs.current["search-id"] = el; }}>
            <ApiEndpoint
              id="search-id"
              method="POST"
              path="/api/reef/search/[id]"
              description="Retrieve search results for a given search ID."
              urlParams={[
                {
                  name: "id",
                  description: "The search ID returned from /api/reef/papers/new",
                },
              ]}
              requestBody={[{ name: "userId", type: "string", description: "Your API key" }]}
              response={[
                { name: "search", type: "", nested: "id, title, abstract, created_at" },
                {
                  name: "papers",
                  type: "",
                  nested: "id, title, abstract, authors, publish_date, doi, similarity",
                },
              ]}
              example={`curl -X POST ${baseUrl}/api/reef/search/SEARCH_ID \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "${user?.id || "YOUR_API_KEY"}"}'`}
              expandedSection={expandedSection}
              onToggle={handleToggle}
              copiedEndpoint={copiedEndpoint}
              onCopy={copyToClipboard}
            />
          </div>

          {/* Pearl API Section Header */}
          <div className="mt-6 mb-3">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Pearl API
            </h2>
            <p className="text-xs text-white/40 mt-1">
              AI-powered research angle discovery from academic papers
            </p>
          </div>

          {/* POST /api/pearl/extract-claims */}
          <div ref={(el) => { sectionRefs.current["extract-claims"] = el; }}>
            <ApiEndpoint
              id="extract-claims"
              method="POST"
              path="/api/pearl/extract-claims"
              description="Extract scientific claims, methods, limitations, and conclusions from ArXiv papers using AI analysis."
              requestBody={[
                { name: "userId", type: "string", description: "Your API key" },
                { name: "arxiv_ids", type: "string[]", description: "Array of ArXiv paper IDs to analyze" },
              ]}
              response={[
                {
                  name: "papers",
                  type: "",
                  nested: "arxiv_id, claims[], methods[], limitations[], conclusion",
                },
                {
                  name: "errors",
                  type: "",
                  nested: "arxiv_id, error (optional, for failed extractions)",
                },
              ]}
              example={`curl -X POST ${baseUrl}/api/pearl/extract-claims \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "${user?.id || "YOUR_API_KEY"}", "arxiv_ids": ["2401.12345", "2401.67890"]}'`}
              expandedSection={expandedSection}
              onToggle={handleToggle}
              copiedEndpoint={copiedEndpoint}
              onCopy={copyToClipboard}
            />
          </div>

          {/* POST /api/pearl/gen-angles */}
          <div ref={(el) => { sectionRefs.current["gen-angles"] = el; }}>
            <ApiEndpoint
              id="gen-angles"
              method="POST"
              path="/api/pearl/gen-angles"
              description="Generate novel research angles based on analyzed papers and your research idea. Returns top 3 angles ranked by novelty, practicality, and impact."
              requestBody={[
                { name: "userId", type: "string", description: "Your API key" },
                { name: "researchIdea", type: "string", description: "Your original research idea/abstract" },
                { name: "papers", type: "PaperAnalysis[]", description: "Array of analyzed papers from extract-claims" },
              ]}
              response={[
                {
                  name: "angles",
                  type: "",
                  nested: "title, description, novelty, practicality, impact, overallScore, reasoning, briefPlan[], relatedLimitations[]",
                },
                { name: "analyzedPapers", type: "number", nested: undefined },
                { name: "userIdea", type: "string", nested: undefined },
              ]}
              example={`curl -X POST ${baseUrl}/api/pearl/gen-angles \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "${user?.id || "YOUR_API_KEY"}", "researchIdea": "...", "papers": [...]}'`}
              expandedSection={expandedSection}
              onToggle={handleToggle}
              copiedEndpoint={copiedEndpoint}
              onCopy={copyToClipboard}
            />
          </div>

          {/* POST /api/pearl/gen-abstract */}
          <div ref={(el) => { sectionRefs.current["gen-abstract"] = el; }}>
            <ApiEndpoint
              id="gen-abstract"
              method="POST"
              path="/api/pearl/gen-abstract"
              description="Generate a research proposal abstract from a selected research angle. Costs 1 credit."
              requestBody={[
                { name: "userId", type: "string", description: "Your API key" },
                { name: "selectedAngle", type: "ResearchAngle", description: "A research angle object from gen-angles output" },
                { name: "userIdea", type: "string", description: "Your original research idea (min 20 chars)" },
                { name: "additionalContext", type: "string?", description: "Optional additional context or requirements" },
              ]}
              response={[
                {
                  name: "generated",
                  type: "",
                  nested: "title, abstract, keywords[], contributions[]",
                },
                { name: "basedOnAngle", type: "string", nested: undefined },
                { name: "userIdea", type: "string", nested: undefined },
              ]}
              example={`curl -X POST ${baseUrl}/api/pearl/gen-abstract \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "${user?.id || "YOUR_API_KEY"}", "selectedAngle": {...}, "userIdea": "..."}'`}
              expandedSection={expandedSection}
              onToggle={handleToggle}
              copiedEndpoint={copiedEndpoint}
              onCopy={copyToClipboard}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
