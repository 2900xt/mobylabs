"use client";

import { usePathname } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

export default function ReefAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading: authLoading, signOut } = useAuth();
  const supabase = createClient();
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const handleLogout = async () => {
    await signOut();
    //when I sign out, I want to redirect to the login page
    window.location.href = "/auth/login";
  };

  // Hide sidebar on auth pages
  const isAuthPage = pathname?.startsWith("/auth");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("whitelisted")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);

          // If profile doesn't exist (PGRST116), logout the user
          if (error.code === "PGRST116") {
            console.log("Profile not found, logging out user");
            await signOut();
            window.location.href = "/auth/login";
            return;
          }

          setIsWhitelisted(false);
        } else {
          setIsWhitelisted(data?.whitelisted || false);
        }
      } catch (err) {
        console.error("Error:", err);
        setIsWhitelisted(false);
      } finally {
        setProfileLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, supabase, signOut]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Show loading while checking whitelist status
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center pt-11">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  // Show "releasing soon" message if user is not whitelisted
  if (isWhitelisted === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 pt-11">
        {/* Background effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[150px]" />
        </div>

        <div className="relative z-10 text-center max-w-md">
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Reef is Releasing Soon</h1>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              We're putting the finishing touches on the app. You'll receive access once we officially launch. Thank you for your patience!
            </p>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 pt-11">
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
