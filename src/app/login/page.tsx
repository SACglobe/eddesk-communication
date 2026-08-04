"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "@/domains/auth/queries";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";

function LoginContent() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // If already authenticated, redirect to home
    useEffect(() => {
        const supabase = createClient();
        let isMounted = true;

        supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
            if (!isMounted) return;
            if (userError || !user) {
                return;
            }
            router.push("/");
        }).catch((err) => {
            console.error("getUser network error:", err);
        });

        return () => {
            isMounted = false;
        };
    }, [router]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data, error } = await signInWithEmail(email, password);

            if (error) {
                const msg = error.message || "Invalid email or password. Please try again.";
                if (msg.includes("Failed to fetch") || msg.includes("fetch")) {
                    setError("Connection Error: Unable to connect to Supabase authentication server. If you have an ad-blocker or Brave Shields active, please disable it for localhost or allow *.supabase.co.");
                } else {
                    setError(msg);
                }
                setLoading(false);
                return;
            }

            router.push("/");
        } catch (err: any) {
            setError("Connection error: Please check your internet connection or ad-blocker.");
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 relative overflow-hidden pb-16">

            {/* Subtle background decoration */}
            <div
                style={{
                    position: 'absolute', inset: 0, zIndex: 0,
                    background: 'radial-gradient(ellipse at 60% 0%, rgba(245,73,39,0.06) 0%, transparent 60%), radial-gradient(ellipse at 0% 100%, rgba(245,73,39,0.04) 0%, transparent 50%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Login Card */}
            <div
                className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-10"
                style={{ boxShadow: '0 4px 32px 0 rgba(0,0,0,0.07)' }}
            >
                {/* Brand Section */}
                <div className="flex flex-col items-center text-center" style={{ marginBottom: '1.75rem' }}>
                    <BrandLogo variant="full" size="xl" />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" style={{ marginBottom: '1.75rem' }} />

                <div className="flex flex-col items-center text-center mb-6">
                    <p className="text-sm font-semibold text-gray-900 tracking-tight">
                        Login
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@school.com"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F54927]/40 focus:border-[#F54927] transition-all"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Password
                        </label>
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F54927]/40 focus:border-[#F54927] transition-all"
                        />
                    </div>

                    {/* Show Password Toggle */}
                    <div className="flex items-center">
                        <input
                            id="show-password"
                            type="checkbox"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                            className="h-4 w-4 text-[#F54927] focus:ring-[#F54927] border-gray-300 rounded cursor-pointer accent-[#F54927]"
                        />
                        <label htmlFor="show-password" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                            Show password
                        </label>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        id="login-submit-btn"
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 text-white font-semibold text-sm py-2.5 rounded-lg transition-all duration-150 mt-2 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #F54927 0%, #ff6b52 100%)', boxShadow: '0 2px 12px 0 rgba(245,73,39,0.25)' }}
                    >
                        {loading ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Logging in…
                            </>
                        ) : "Login"}
                    </button>
                </form>

                {/* T&C Notice */}
                <p className="text-center text-[11px] text-gray-400 mt-5 leading-relaxed px-2">
                    By logging in, you confirm that you have read and agree to our{" "}
                    <a
                        href="https://www.eddesk.in/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#F54927] font-semibold hover:underline underline-offset-2 transition-all"
                    >
                        Terms &amp; Conditions
                    </a>
                    .
                </p>
            </div>

            {/* Bottom Footer */}
            <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 py-3 px-4 text-center">
                    <span className="text-[11px] font-semibold text-gray-400 tracking-tight">
                        <span className="text-gray-500 font-bold">EdDesk</span>
                        {" "}· Powered by{" "}
                        <span className="text-gray-500 font-bold">SAC Globe Tech ( V: 1.0.1 )</span>
                    </span>
                    <span className="hidden sm:inline text-gray-300 text-[11px]">·</span>
                    <span className="text-[11px] text-gray-400">
                        &copy; 2026 SAC Globe Tech. All rights reserved.
                    </span>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
