"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  History,
  Coins,
  BadgeCheck,
  GraduationCap,
  Smartphone,
  Headset,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/send", label: "Send Report Card", icon: Send },
  { href: "/invite", label: "Invite Parents", icon: Smartphone },
  { href: "/manage-classes", label: "Manage Classes", icon: GraduationCap },
  { href: "/history", label: "History", icon: History },
  { href: "/topup", label: "Credits", icon: Coins },
  { href: "/plans", label: "Subscription", icon: BadgeCheck },
  { href: "/contact", label: "Contact & Support", icon: Headset },
] as const;

export default function AppSidebar() {
  const pathname = usePathname();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    async function loadCredits() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          let { data: whatsappUser } = await supabase
            .from("whatsappusers")
            .select("schoolkey")
            .eq("authuserid", user.id)
            .maybeSingle();

          if (!whatsappUser && user.email) {
            const { data: userByEmail } = await supabase
              .from("whatsappusers")
              .select("schoolkey")
              .ilike("email", user.email.trim().toLowerCase())
              .maybeSingle();
            if (userByEmail) whatsappUser = userByEmail;
          }

          if (whatsappUser?.schoolkey) {
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("whatsappcredit")
              .eq("schoolkey", whatsappUser.schoolkey)
              .maybeSingle();

            if (sub) {
              setCredits(sub.whatsappcredit ?? 0);
            }
          }
        }
      } catch (err) {
        console.error("Sidebar credit load error:", err);
      }
    }

    loadCredits();

    const handleCreditsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (typeof customEvent.detail === "number") {
        setCredits(customEvent.detail);
      } else {
        loadCredits();
      }
    };

    window.addEventListener("credits_updated", handleCreditsUpdate);
    return () => {
      window.removeEventListener("credits_updated", handleCreditsUpdate);
    };
  }, []);

  return (
    <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <img
          src="/logo-full-1.png"
          alt="EdDesk Communication Suite"
          className="h-9 w-auto max-w-[200px] object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.includes("logo-full-1.png")) {
              target.src = "/logo-full.png";
            } else {
              target.style.display = "none";
            }
          }}
        />
      </Link>

      <p className="px-3 pb-2 text-eyebrow">Communication</p>
      <nav className="flex flex-col gap-0.5">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              ].join(" ")}
            >
              <item.icon
                className={[
                  "size-[18px] shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                ].join(" ")}
                strokeWidth={1.9}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-border bg-primary-soft/60 p-4">
        <p className="text-eyebrow">Credits left</p>
        <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
          {credits !== null ? credits.toLocaleString() : "..."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">1 credit = 1 report card</p>
        <Link
          href="/topup"
          className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
        >
          Top up credits →
        </Link>
      </div>
    </aside>
  );
}
