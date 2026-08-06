"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail } from "@/domains/auth/queries";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import { Eye, EyeOff, ArrowRight, MessageSquare, BarChart3, CheckCircle2 } from "lucide-react";

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    supabase.auth.getUser().then(({ data: { user }, error: e }) => {
      if (!alive || e || !user) return;
      router.push("/");
    }).catch(() => {});
    return () => { alive = false; };
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authErr } = await signInWithEmail(email, password);
      if (authErr) {
        const msg = authErr.message || "Invalid email or password.";
        setError(msg.includes("fetch") ? "Connection error – please disable any ad-blocker." : msg);
        setLoading(false);
        return;
      }
      router.push("/");
    } catch {
      setError("Connection error – please check your internet connection.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#fafafa]">

      {/* ═══════════ LEFT BRAND PANEL ═══════════ */}
      <div className="hidden lg:flex w-[48%] xl:w-[52%] flex-col relative overflow-hidden bg-white">

        {/* Soft brand-tinted background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 80% 10%, rgba(245,73,39,0.07) 0%, transparent 55%), radial-gradient(ellipse at 10% 90%, rgba(255,107,82,0.05) 0%, transparent 50%)",
          }}
        />

        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(245,73,39,0.08) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Red accent bar — left edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 pointer-events-none"
          style={{ background: "linear-gradient(180deg, #F54927 0%, #FF6B52 100%)" }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">

          {/* Logo on white — perfectly visible */}
          <div>
            <BrandLogo variant="full" size="lg" className="justify-start" />
          </div>

          {/* Center hero text */}
          <div className="flex-1 flex flex-col justify-center mt-12 mb-8">

            {/* Pill badge */}
            <div className="flex mb-6">
              <span
                className="inline-flex items-center gap-2 rounded-full text-[11px] font-bold tracking-widest uppercase px-3.5 py-1.5"
                style={{
                  background: "rgba(245,73,39,0.09)",
                  border: "1px solid rgba(245,73,39,0.2)",
                  color: "#F54927",
                }}
              >
                <span className="size-1.5 rounded-full bg-[#F54927] animate-pulse inline-block" />
                WhatsApp Communication Suite
              </span>
            </div>

            <h1
              className="font-bold leading-[1.12] mb-5 max-w-md"
              style={{ fontSize: "clamp(1.85rem,2.6vw,2.6rem)", letterSpacing: "-0.035em", color: "#111827" }}
            >
              Deliver Report Cards to{" "}
              <span style={{ color: "#F54927" }}>
                Every Parent
              </span>
              {" "}in Seconds
            </h1>

            <p className="text-sm leading-relaxed max-w-sm" style={{ color: "#6b7280" }}>
              A complete school communication platform — send exam results, track delivery, and manage all your classes from one place.
            </p>

            {/* Feature list */}
            <div className="mt-10 space-y-4">
              {[
                { icon: MessageSquare, title: "Instant WhatsApp Delivery", desc: "Send report cards directly to parents in seconds" },
                { icon: BarChart3, title: "Live Delivery Analytics", desc: "Track message delivery rates in real time" },
                { icon: CheckCircle2, title: "Multi-Class Management", desc: "Organise students across classes, sections & subjects" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div
                    className="flex-shrink-0 size-9 rounded-xl flex items-center justify-center mt-0.5"
                    style={{ background: "rgba(245,73,39,0.09)", border: "1px solid rgba(245,73,39,0.18)" }}
                  >
                    <Icon className="size-4" style={{ color: "#F54927" }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#111827" }}>{title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom quote card */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "rgba(245,73,39,0.04)",
              border: "1px solid rgba(245,73,39,0.12)",
            }}
          >
            <p className="text-xs leading-relaxed italic mb-3" style={{ color: "#6b7280" }}>
              "EdDesk has transformed how we communicate exam results to parents. What used to take hours now happens in minutes."
            </p>
            <div className="flex items-center gap-2.5">
              <div
                className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #F54927, #FF6B52)" }}
              >
                SC
              </div>
              <div>
                <p className="text-xs font-semibold leading-none" style={{ color: "#374151" }}>School Coordinator</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#9ca3af" }}>Government Hr. Sec. School, Tamil Nadu</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ RIGHT FORM PANEL ═══════════ */}
      <div className="flex-1 flex flex-col">

        {/* Mobile logo header */}
        <div className="lg:hidden px-6 pt-8 pb-4">
          <BrandLogo variant="full" size="md" className="justify-start" />
        </div>

        {/* Form centred */}
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[380px]">

            {/* Form heading */}
            <div className="mb-8 lg:mb-10">
              <p
                className="text-xs font-bold tracking-widest uppercase mb-2"
                style={{ color: "#F54927" }}
              >
                Welcome back
              </p>
              <h2
                className="text-foreground font-bold leading-tight mb-2"
                style={{ fontSize: "1.65rem", letterSpacing: "-0.03em" }}
              >
                Sign in to your account
              </h2>
              <p className="text-muted-foreground text-sm">
                Use your school email and password to access the dashboard.
              </p>
            </div>

            {/* ── FORM ── */}
            <form onSubmit={handleLogin} noValidate className="space-y-4">

              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-foreground block">
                  School Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourschool.com"
                  className="w-full h-11 px-4 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground/40 bg-white transition-all outline-none"
                  style={{
                    border: "1.5px solid #e5e7eb",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#F54927";
                    e.target.style.boxShadow = "0 0 0 3px rgba(245,73,39,0.10)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e5e7eb";
                    e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                  }}
                />
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-foreground block">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-11 pl-4 pr-11 rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground/40 bg-white transition-all outline-none"
                    style={{
                      border: "1.5px solid #e5e7eb",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#F54927";
                      e.target.style.boxShadow = "0 0 0 3px rgba(245,73,39,0.10)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#e5e7eb";
                      e.target.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  className="flex gap-2.5 items-start rounded-xl px-4 py-3 text-xs leading-relaxed"
                  style={{
                    background: "rgba(245,73,39,0.06)",
                    border: "1px solid rgba(245,73,39,0.18)",
                    color: "#b91c1c",
                  }}
                >
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Submit button */}
              <div className="pt-1">
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="group w-full h-12 rounded-xl flex items-center justify-center gap-2.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #F54927 0%, #d93f1f 100%)",
                    boxShadow: "0 4px 20px rgba(245,73,39,0.35), 0 1px 0 rgba(255,255,255,0.1) inset",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        "0 6px 28px rgba(245,73,39,0.45), 0 1px 0 rgba(255,255,255,0.1) inset";
                      (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 4px 20px rgba(245,73,39,0.35), 0 1px 0 rgba(255,255,255,0.1) inset";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }}
                >
                  {loading ? (
                    <>
                      <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Signing in…</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-1"
                        strokeWidth={2.2}
                      />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">
                Protected & Encrypted
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4">
              {[
                { emoji: "🔒", label: "SSL Secured" },
                { emoji: "🛡️", label: "Data Private" },
                { emoji: "⚡", label: "99.9% Uptime" },
              ].map(({ emoji, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="text-xs">{emoji}</span>
                  <span className="text-[11px] font-medium">{label}</span>
                </div>
              ))}
            </div>

            {/* Terms */}
            <p className="text-center text-[11px] text-muted-foreground/70 leading-relaxed mt-6">
              By signing in you agree to our{" "}
              <a
                href="https://www.eddesk.in/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2 hover:no-underline transition-all"
                style={{ color: "#F54927" }}
              >
                Terms &amp; Conditions
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-6 py-4 text-center border-t border-border/60">
          <p className="text-[11px] text-muted-foreground">
            &copy; 2026{" "}
            <span className="font-semibold text-foreground/70">SAC Globe Tech</span>
            {" "}· EdDesk v1.0.1
          </p>
        </footer>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
          <div
            className="size-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "#F54927", borderTopColor: "transparent" }}
          />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
