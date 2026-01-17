"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";

export default function DocsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("papers-new");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen bg-slate-950 pt-16 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto py-6">
        <div className="mb-5">
          <h1 className="text-lg font-bold text-white">API Documentation</h1>
          <p className="text-xs text-white/40 mt-1">Integrate Reef search into your applications</p>
        </div>

        {/* Authentication */}
        <div className="bg-slate-900/60 border border-white/5 rounded p-3 mb-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-2">Authentication</p>
          <p className="text-xs text-white/60 leading-relaxed">
            All requests require a <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded">userId</code> parameter in the request body.
            Your API key is your user ID, found on your <a href="/profile" className="text-cyan-400 hover:underline">profile page</a>.
          </p>
        </div>

        {/* Life Cycle of 3 days */}
        <div className="bg-slate-900/60 border border-white/5 rounded p-3 mb-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-2">Search Life Cycle</p>
          <p className="text-xs text-white/60 leading-relaxed">
            All requests and stored searches have a life cycle of 3 days. After this period, searches and their associated data will be automatically deleted from our servers to ensure data privacy and optimal performance.
          </p>
        </div>

        {/* POST /api/papers/new */}
        <div className="bg-slate-900/60 border border-white/5 rounded mb-3 overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === "papers-new" ? null : "papers-new")}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">POST</span>
              <code className="text-xs text-white/80">/api/papers/new</code>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${expandedSection === "papers-new" ? "rotate-180" : ""}`} />
          </button>

          {expandedSection === "papers-new" && (
            <div className="px-3 pb-3 border-t border-white/5 pt-3">
              <p className="text-xs text-white/50 mb-3">Create a new search from an abstract. Costs 1 credit.</p>

              <div className="mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Request Body</p>
                <div className="bg-slate-950/50 rounded p-2 text-[11px] font-mono">
                  <div className="text-white/60">{"{"}</div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"userId"</span>
                    <span className="text-white/40">: </span>
                    <span className="text-amber-400">"string"</span>
                    <span className="text-white/30">,</span>
                    <span className="text-white/30 ml-2">// Your API key</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"abstract"</span>
                    <span className="text-white/40">: </span>
                    <span className="text-amber-400">"string"</span>
                    <span className="text-white/30 ml-2">// Paper abstract to search</span>
                  </div>
                  <div className="text-white/60">{"}"}</div>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Response</p>
                <div className="bg-slate-950/50 rounded p-2 text-[11px] font-mono">
                  <div className="text-white/60">{"{"}</div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"searchId"</span>
                    <span className="text-white/40">: </span>
                    <span className="text-amber-400">"uuid"</span>
                    <span className="text-white/30">,</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"message"</span>
                    <span className="text-white/40">: </span>
                    <span className="text-amber-400">"Search saved successfully"</span>
                  </div>
                  <div className="text-white/60">{"}"}</div>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Example</p>
                <div className="relative bg-slate-950/50 rounded p-2">
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${baseUrl}/api/papers/new \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "YOUR_API_KEY", "abstract": "Your paper abstract here..."}'`, "papers-new-curl")}
                    className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    {copiedEndpoint === "papers-new-curl" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-white/40" />
                    )}
                  </button>
                  <pre className="text-[11px] font-mono text-white/60 overflow-x-auto pr-8">
{`curl -X POST ${baseUrl}/api/papers/new \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "YOUR_API_KEY", "abstract": "..."}'`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* POST /api/search/[id] */}
        <div className="bg-slate-900/60 border border-white/5 rounded mb-3 overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === "search-id" ? null : "search-id")}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">POST</span>
              <code className="text-xs text-white/80">/api/search/[id]</code>
            </div>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${expandedSection === "search-id" ? "rotate-180" : ""}`} />
          </button>

          {expandedSection === "search-id" && (
            <div className="px-3 pb-3 border-t border-white/5 pt-3">
              <p className="text-xs text-white/50 mb-3">Retrieve search results for a given search ID.</p>

              <div className="mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">URL Parameters</p>
                <div className="text-xs text-white/60">
                  <code className="text-cyan-400">id</code> — The search ID returned from <code className="text-white/40">/api/papers/new</code>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Request Body</p>
                <div className="bg-slate-950/50 rounded p-2 text-[11px] font-mono">
                  <div className="text-white/60">{"{"}</div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"userId"</span>
                    <span className="text-white/40">: </span>
                    <span className="text-amber-400">"string"</span>
                    <span className="text-white/30 ml-2">// Your API key</span>
                  </div>
                  <div className="text-white/60">{"}"}</div>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Response</p>
                <div className="bg-slate-950/50 rounded p-2 text-[11px] font-mono">
                  <div className="text-white/60">{"{"}</div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"search"</span>
                    <span className="text-white/40">: {"{"}</span>
                    <span className="text-white/30"> id, title, abstract, created_at </span>
                    <span className="text-white/40">{"}"}</span>
                    <span className="text-white/30">,</span>
                  </div>
                  <div className="pl-3">
                    <span className="text-cyan-400">"papers"</span>
                    <span className="text-white/40">: [{"{"}</span>
                    <span className="text-white/30"> id, title, abstract, authors, publish_date, doi, similarity </span>
                    <span className="text-white/40">{"}"}]</span>
                  </div>
                  <div className="text-white/60">{"}"}</div>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-1.5">Example</p>
                <div className="relative bg-slate-950/50 rounded p-2">
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${baseUrl}/api/search/SEARCH_ID \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "${user.id}"}'`, "search-id-curl")}
                    className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    {copiedEndpoint === "search-id-curl" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-white/40" />
                    )}
                  </button>
                  <pre className="text-[11px] font-mono text-white/60 overflow-x-auto pr-8">
{`curl -X POST ${baseUrl}/api/search/SEARCH_ID \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "${user.id}"}'`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Codes */}
        <div className="bg-slate-900/60 border border-white/5 rounded p-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-2">Error Codes</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex gap-3">
              <code className="text-rose-400 w-8">400</code>
              <span className="text-white/50">Missing or invalid parameters</span>
            </div>
            <div className="flex gap-3">
              <code className="text-rose-400 w-8">402</code>
              <span className="text-white/50">Insufficient credits</span>
            </div>
            <div className="flex gap-3">
              <code className="text-rose-400 w-8">404</code>
              <span className="text-white/50">User or search not found</span>
            </div>
            <div className="flex gap-3">
              <code className="text-rose-400 w-8">500</code>
              <span className="text-white/50">Internal server error</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
