"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
    router.push("/auth/login");
  };

  const getUserInitials = () => {
    if (!user) return "";
    const metadata = user.user_metadata;
    if (metadata?.full_name) {
      const names = metadata.full_name.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return names[0][0].toUpperCase();
    }
    if (metadata?.name) {
      const names = metadata.name.split(" ");
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

  const isAuthPage = pathname?.startsWith("/auth");
  if (isAuthPage) return null;

  const navLinks = [
    { href: "/reef", label: "Reef" },
    { href: "/pearl", label: "Pearl" },
    { href: "/docs", label: "Docs" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-11 bg-slate-900 border-b border-white/10 z-50">
      <div className="h-full max-w-5xl mx-auto px-4 flex items-center justify-between">
        {/* Left - Logo */}
        <Link href="/" className="flex items-center gap-1.5">
          <Image src="/logo.png" alt="Moby Labs" width={20} height={20} />
          <span className="text-sm font-semibold text-white">Moby Labs</span>
        </Link>

        {/* Center - Nav Links */}
        <div className="flex items-center gap-6">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-sm py-3 transition-colors ${
                  active
                    ? "text-white font-medium"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right - Profile */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {getUserInitials()}
            </button>

            {dropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-44 bg-slate-800 rounded-lg shadow-xl border border-white/10 py-1 z-50">
                <div className="px-3 py-2 border-b border-white/10">
                  <p className="text-sm text-white/90 truncate">
                    {user.user_metadata?.full_name || user.user_metadata?.name || "User"}
                  </p>
                  <p className="text-xs text-white/50 truncate">{user.email}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
