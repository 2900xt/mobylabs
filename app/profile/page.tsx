"use client";

import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Plus, Coins, Loader2, ChevronDown, Copy, Check, Key, Eye, EyeOff } from "lucide-react";

import { CREDIT_PACKAGES } from "@/lib/stripe/packages";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  credits_remaining: number;
  created_at: string | null;
  updated_at: string | null;
  whitelisted: boolean;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (params.get('success') && sessionId) {
      verifyAndAddCredits(sessionId);
    } else if (params.get('canceled')) {
      setError('Payment was cancelled');
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  const verifyAndAddCredits = async (sessionId: string) => {
    try {
      const response = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(`Payment successful! ${data.added} credits have been added.`);
        fetchProfile();
      } else {
        setSuccess('Payment successful! Your credits have been added.');
        fetchProfile();
      }
    } catch (err) {
      console.error('Verification error:', err);
      setSuccess('Payment successful! Your credits should be updated shortly.');
      fetchProfile();
    } finally {
      window.history.replaceState({}, '', '/profile');
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        throw error;
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const getCreditsColor = (credits: number) => {
    if (credits > 50) return "text-emerald-400";
    if (credits > 20) return "text-amber-400";
    return "text-rose-400";
  };

  const handleBuyCredits = async (packageType: 'SMALL' | 'MEDIUM' | 'LARGE') => {
    try {
      setCheckoutLoading(true);
      setError(null);

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) return null;

  const metadata = user.user_metadata || {};
  const avatarUrl = metadata.avatar_url || metadata.picture;

  return (
    <div className="min-h-screen bg-slate-950 pt-16 px-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/3 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto py-6">
        {/* Header with avatar */}
        <div className="flex items-center gap-3 mb-5">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              className="w-10 h-10 rounded-full border border-cyan-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {(profile?.full_name || user.email)?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <div>
            <h1 className="text-lg font-semibold text-white">{profile?.full_name || 'Profile'}</h1>
            <p className="text-xs text-white/40 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-xs">
            {success}
          </div>
        )}

        {/* Credits Card */}
        <div className="bg-slate-900/60 border border-white/5 rounded p-4 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded">
                <Coins className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Credits</p>
                <p className={`text-xl font-bold ${getCreditsColor(profile?.credits_remaining || 0)}`}>
                  {profile?.credits_remaining ?? 0}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPricing(!showPricing)}
              disabled={checkoutLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-50 text-cyan-400 text-xs font-medium rounded transition-colors"
            >
              {checkoutLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Plus className="w-3 h-3" />
                  Buy
                  <ChevronDown className={`w-3 h-3 transition-transform ${showPricing ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pricing Options */}
        {showPricing && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {/* Starter */}
            <button
              onClick={() => handleBuyCredits('SMALL')}
              disabled={checkoutLoading}
              className="bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 rounded p-3 text-center transition-colors disabled:opacity-50"
            >
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Starter</p>
              <p className="text-lg font-bold text-cyan-400">${CREDIT_PACKAGES.SMALL.price / 100}</p>
              <p className="text-xs text-white/60">{CREDIT_PACKAGES.SMALL.credits} credits</p>
            </button>

            {/* Pro - Popular */}
            <button
              onClick={() => handleBuyCredits('MEDIUM')}
              disabled={checkoutLoading}
              className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 hover:border-cyan-500/50 rounded p-3 text-center transition-colors disabled:opacity-50"
            >
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-cyan-500 text-[9px] text-white font-bold px-2 py-0.5 rounded-full">
                BEST
              </span>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Pro</p>
              <p className="text-lg font-bold text-cyan-400">${CREDIT_PACKAGES.MEDIUM.price / 100}</p>
              <p className="text-xs text-white/60">{CREDIT_PACKAGES.MEDIUM.credits} credits</p>
            </button>

            {/* Enterprise */}
            <button
              onClick={() => handleBuyCredits('LARGE')}
              disabled={checkoutLoading}
              className="bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 rounded p-3 text-center transition-colors disabled:opacity-50"
            >
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Power</p>
              <p className="text-lg font-bold text-cyan-400">${CREDIT_PACKAGES.LARGE.price / 100}</p>
              <p className="text-xs text-white/60">{CREDIT_PACKAGES.LARGE.credits} credits</p>
            </button>
          </div>
        )}

        {/* API Key */}
        <div className="bg-slate-900/60 border border-white/5 rounded p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Key className="w-3 h-3 text-white/40" />
              <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">API Key</p>
            </div>
            <a href="/docs" className="text-[10px] text-cyan-400 hover:underline">View docs</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="flex-1 text-left text-[11px] font-mono text-white/60 bg-slate-950/50 px-2 py-1.5 rounded truncate hover:bg-slate-950/70 transition-colors cursor-pointer"
            >
              {showApiKey ? user.id : '••••••••••••••••••••••••••••••••••••'}
            </button>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title={showApiKey ? "Hide API key" : "Show API key"}
            >
              {showApiKey ? (
                <EyeOff className="w-3.5 h-3.5 text-white/40" />
              ) : (
                <Eye className="w-3.5 h-3.5 text-white/40" />
              )}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.id);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Copy API key"
            >
              {copiedKey ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/40" />
              )}
            </button>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-slate-900/60 border border-white/5 rounded p-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium mb-2">Account</p>
          <div className="space-y-2 text-xs">
            {profile?.full_name && (
              <div className="flex justify-between">
                <span className="text-white/40">Name</span>
                <span className="text-white/70">{profile.full_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-white/40">Provider</span>
              <span className="text-white/70">Google</span>
            </div>
            {profile?.created_at && (
              <div className="flex justify-between">
                <span className="text-white/40">Joined</span>
                <span className="text-white/70">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
