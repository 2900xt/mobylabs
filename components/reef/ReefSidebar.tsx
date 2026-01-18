"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MessageSquare, User, LogOut, Code2, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

interface SearchHistoryItem {
  id: string;
  title: string;
  abstract?: string;
  created_at: string;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [allSearches, setAllSearches] = useState<SearchHistoryItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Extract current search ID from pathname
  const currentSearchId = pathname?.startsWith('/search/')
    ? pathname.split('/')[2]
    : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch user's credits and search history
  useEffect(() => {
    if (user) {
      fetchCredits();
      fetchSearchHistory();
    }
  }, [user, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch all searches when user starts searching
  useEffect(() => {
    if (isSearching && allSearches.length === 0) {
      fetchAllSearches();
    }
  }, [isSearching]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCredits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("credits_remaining")
        .eq("id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Profile doesn't exist, create one
          const { data: newProfile } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
              credits_remaining: 100,
            })
            .select()
            .single();

          if (newProfile) {
            setCreditsRemaining(newProfile.credits_remaining);
          }
        }
      } else if (data) {
        setCreditsRemaining(data.credits_remaining);
      }
    } catch (err) {
      console.error("Error fetching credits:", err);
    }
  };

  const fetchSearchHistory = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("reef_searches")
        .select("id, title, abstract, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching search history:", error);
        return;
      }

      setSearchHistory(data || []);
    } catch (err) {
      console.error("Error fetching search history:", err);
    }
  };

  const fetchAllSearches = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("reef_searches")
        .select("id, title, abstract, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching all searches:", error);
        return;
      }

      setAllSearches(data || []);
    } catch (err) {
      console.error("Error fetching all searches:", err);
    }
  };

  // Filter searches based on query
  const filteredSearches = searchQuery.trim()
    ? allSearches.filter(
        (item) =>
          item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.abstract?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchHistory;

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
    router.push("/auth/login");
  };

  // Get user initials for the avatar
  const getUserInitials = () => {
    if (!user) return "";
    const metadata = user.user_metadata;
    // For Google OAuth, use full_name or name
    if (metadata?.full_name) {
      const names = metadata.full_name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (metadata?.name) {
      const names = metadata.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-white/10 flex flex-col">
      {/* Header with Logo */}
      <div className="px-7 py-4 flex items-center gap-2">
        <Image src="/logo.png" alt="Moby Labs Logo" width={20} height={20} />
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
            Moby Labs
          </span>
          <span className="text-sm font-semibold bg-gradient-to-r from-cyan-500 to-cyan-500 bg-clip-text text-transparent">
            Reef
          </span>
        </div>
      </div>

      {/* New Search Button */}
      <div className="px-3 pb-2">
        <Link
          href="/reef"
          className="group flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
            <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-sm text-white/90">New search</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search previous queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setIsSearching(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
            </button>
          )}
        </div>
      </div>

      {/* Search History */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="text-xs font-medium text-white/40 px-3 py-2">
          {searchQuery.trim() ? `Results for "${searchQuery}"` : "Recent Searches"}
        </div>
        {filteredSearches.length === 0 ? (
          <p className="text-xs text-white/30 px-3 py-2">
            {searchQuery.trim() ? "No matching searches found" : "No searches yet"}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filteredSearches.map((item) => {
              const isActive = currentSearchId === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/reef/search/${item.id}`}
                  className={`relative block w-full text-left px-3 py-2 rounded-md transition-all group ${
                    isActive
                      ? "bg-cyan-500/15 border border-cyan-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
                  )}
                  <p
                    className={`text-sm truncate transition-colors ${
                      isActive
                        ? "text-cyan-200 font-medium"
                        : "text-white/70 group-hover:text-white"
                    }`}
                  >
                    {item.title}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* API Docs Link */}
      <div className="px-3 pb-2">
        <Link
          href="/reef/docs"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white/5 transition-colors text-white/50 hover:text-white/80"
        >
          <Code2 className="w-4 h-4" />
          <span className="text-xs">API Docs</span>
        </Link>
      </div>

      {/* Profile Section */}
      <div className="px-3 py-3 border-t border-white/10">
        {user && (
          <div className="relative" ref={dropdownRef}>
            {/* Credits Slider */}
            {creditsRemaining !== null && (
              <div className="mb-3 px-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-white/50">Credits remaining</span>
                  <span className="text-xs font-semibold text-cyan-400">{creditsRemaining}</span>
                </div>
                <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${creditsRemaining}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-semibold flex-shrink-0">
                {getUserInitials()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white/90 truncate">
                  {user.user_metadata?.full_name || user.user_metadata?.name || "User"}
                </p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 rounded-lg shadow-xl border border-white/10 py-1 z-50">
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
