"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center pt-11">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>
      {children}
    </div>
  );
}
