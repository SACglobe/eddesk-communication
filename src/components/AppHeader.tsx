"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  Coins,
  LogOut,
  LayoutDashboard,
  Send,
  GraduationCap,
  History,
  BadgeCheck,
  Headset,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/send", label: "Send Report Card", icon: Send },
  { href: "/manage-classes", label: "Manage Classes", icon: GraduationCap },
  { href: "/history", label: "History", icon: History },
  { href: "/topup", label: "Credits", icon: Coins },
  { href: "/plans", label: "Subscription", icon: BadgeCheck },
  { href: "/contact", label: "Contact & Support", icon: Headset },
] as const;

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(null);
  const [userInitials, setUserInitials] = useState<string>("AR");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadHeaderData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const email = user.email || "";
          const parts = email.split("@")[0].split(/[._-]/);
          if (parts.length >= 2) {
            setUserInitials((parts[0][0] + parts[1][0]).toUpperCase());
          } else if (parts[0]) {
            setUserInitials(parts[0].slice(0, 2).toUpperCase());
          }

          let { data: whatsappUser } = await supabase
            .from("whatsappusers")
            .select("schoolkey, username")
            .eq("authuserid", user.id)
            .maybeSingle();

          if (!whatsappUser && user.email) {
            const { data: userByEmail } = await supabase
              .from("whatsappusers")
              .select("schoolkey, username")
              .ilike("email", user.email.trim().toLowerCase())
              .maybeSingle();
            if (userByEmail) whatsappUser = userByEmail;
          }

          let targetSchoolKey = whatsappUser?.schoolkey;

          let query = supabase.from("subscriptions").select("whatsappcredit");
          if (targetSchoolKey) {
            query = query.eq("schoolkey", targetSchoolKey);
          } else {
            query = query.order("createdat", { ascending: false });
          }

          const { data: subList } = await query.limit(1);
          if (subList && subList.length > 0) {
            setCredits(subList[0].whatsappcredit ?? 0);
          }
        } else {
          const { data: subList } = await supabase
            .from("subscriptions")
            .select("whatsappcredit")
            .order("createdat", { ascending: false })
            .limit(1);
          if (subList && subList.length > 0) {
            setCredits(subList[0].whatsappcredit ?? 0);
          }
        }
      } catch (err) {
        console.error("Header data load error:", err);
      }
    }

    loadHeaderData();

    const handleCreditsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (typeof customEvent.detail === "number") {
        setCredits(customEvent.detail);
      } else {
        loadHeaderData();
      }
    };

    window.addEventListener("credits_updated", handleCreditsUpdate);
    return () => {
      window.removeEventListener("credits_updated", handleCreditsUpdate);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
          
          {/* Mobile Left: Menu Toggle + Logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-accent focus:outline-none"
              aria-label="Open mobile menu"
            >
              <Menu className="size-5" />
            </button>
            <Link href="/" className="flex items-center">
              <img
                src="/logo-full.png"
                alt="EdDesk"
                className="h-7 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </Link>
          </div>

          {/* Right: Credits Pill + User Profile */}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/topup"
              className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 sm:px-3.5"
            >
              <Coins className="size-3.5 text-primary" strokeWidth={2} />
              <span className="tabular-nums font-semibold">
                {credits !== null ? credits.toLocaleString() : "..."}
              </span>
              <span className="hidden sm:inline text-muted-foreground">credits</span>
            </Link>

            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 sm:pr-2.5 transition-colors hover:bg-accent"
              >
                <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {userInitials}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card p-1.5 shadow-pop z-50">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-sidebar p-5 shadow-2xl border-r border-sidebar-border">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-5 border-b border-sidebar-border">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <img
                  src="/logo-full.png"
                  alt="EdDesk"
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Navigation Links */}
            <p className="mt-6 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Communication
            </p>
            <nav className="mt-2 flex flex-col gap-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={[
                      "flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    ].join(" ")}
                  >
                    <item.icon
                      className={[
                        "size-5 shrink-0",
                        active ? "text-primary" : "text-muted-foreground",
                      ].join(" ")}
                      strokeWidth={1.9}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Credits Card at Bottom of Drawer */}
            <div className="mt-auto rounded-xl border border-border bg-primary-soft/60 p-4">
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Credits left
              </p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                {credits !== null ? credits.toLocaleString() : "..."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">1 credit = 1 report card</p>
              <Link
                href="/topup"
                onClick={() => setIsMobileMenuOpen(false)}
                className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
              >
                Top up credits →
              </Link>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
