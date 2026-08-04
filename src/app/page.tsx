"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, ArrowUpRight, Coins, History as HistoryIcon, Layers } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { Metric, Panel, PageHeader, StatusChip } from "@/components/ui-kit";
import { createClient } from "@/lib/supabase/client";

interface RecentSend {
  id: string;
  studentName: string;
  classSec: string;
  examName: string;
  status: string;
  timestamp: string;
}

const actions = [
  {
    href: "/send",
    label: "Send Report Card",
    hint: "Enter marks, preview and send to the parent",
    icon: GraduationCap,
  },
  {
    href: "/manage-classes",
    label: "Manage Classes",
    hint: "Standards, sections and subjects that auto-fill marks",
    icon: Layers,
  },
  {
    href: "/history",
    label: "Delivery History",
    hint: "Every report card sent, with delivery status",
    icon: HistoryIcon,
  },
  {
    href: "/topup",
    label: "Top up Credits",
    hint: "Available credits — add any amount",
    icon: Coins,
  },
];

export default function DashboardPage() {
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const [userName, setUserName] = useState<string>("Teacher");
  const [credits, setCredits] = useState<number>(0);
  const [sentToday, setSentToday] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [successRate, setSuccessRate] = useState<string>("100%");
  const [recentSends, setRecentSends] = useState<RecentSend[]>([]);

  useEffect(() => {
    async function fetchDashboardMetrics() {
      if (!schoolKey) return;
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const parts = user.email.split("@")[0].split(/[._-]/);
        const capitalized = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
        setUserName(capitalized);
      }

      // Fetch credits
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("whatsappcredit")
        .eq("schoolkey", schoolKey)
        .maybeSingle();

      if (sub) {
        setCredits(sub.whatsappcredit || 0);
      }

      // Fetch today's history
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: historyData } = await supabase
        .from("report_card_history")
        .select("*")
        .eq("schoolkey", schoolKey)
        .order("created_at", { ascending: false });

      if (historyData) {
        const todayCount = historyData.filter(
          item => new Date(item.created_at) >= todayStart
        ).length;
        setSentToday(todayCount);

        const failedToday = historyData.filter(
          item =>
            new Date(item.created_at) >= todayStart &&
            (item.status === "failed" || item.status === "undelivered")
        ).length;
        setFailedCount(failedToday);

        const totalAllTime = historyData.length;
        const failedAllTime = historyData.filter(
          item => item.status === "failed" || item.status === "undelivered"
        ).length;

        if (totalAllTime > 0) {
          const success = totalAllTime - failedAllTime;
          setSuccessRate(`${((success / totalAllTime) * 100).toFixed(1)}%`);
        }

        setRecentSends(
          historyData.slice(0, 5).map(item => ({
            id: item.id.toString(),
            studentName: item.studentname,
            classSec: item.classsec,
            examName: item.examname,
            status: item.status || "sent",
            timestamp: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }))
        );
      }
    }

    if (isAuthorized) {
      fetchDashboardMetrics();
    }
  }, [isAuthorized, schoolKey]);

  if (accessError) {
    return <AccessDenied type={accessError} />;
  }

  if (isLoading || !isAuthorized) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-10">
        <PageHeader
          eyebrow="Report card centre"
          title={`Good day, ${userName}`}
          description="Report cards are the only thing you send from here — enter marks, check the preview, send."
          action={
            <Link
              href="/send"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5"
            >
              New report card
              <ArrowUpRight className="size-4" strokeWidth={2.2} />
            </Link>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((a) => (
            <Link key={a.label} href={a.href} className="action-tile group flex flex-col gap-6 p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <a.icon className="size-[22px]" strokeWidth={1.9} />
              </span>
              <span>
                <span className="block font-display text-[17px] font-semibold">{a.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{a.hint}</span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Open
                <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
              </span>
            </Link>
          ))}
        </section>

        <div className="hairline" />

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Today's activity</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Report cards sent today" value={sentToday.toString()} sub="Across all classes" />
            <Metric label="Credits remaining" value={credits.toLocaleString()} sub="1 credit per report card" />
            <Metric label="Delivery success" value={successRate} sub="All time delivery rate" tone="success" />
            <Metric label="Failed deliveries" value={failedCount.toString()} sub={failedCount > 0 ? "Today" : "No failures"} tone={failedCount > 0 ? "danger" : "default"} />
          </div>
        </section>

        <Panel
          title="Recent report cards"
          hint="Latest sent report cards"
          action={
            <Link href="/history" className="text-xs font-medium text-primary hover:underline">
              View history →
            </Link>
          }
        >
          {recentSends.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No report cards sent yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentSends.map((m) => (
                <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.studentName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.classSec} · {m.examName} · {m.timestamp}
                    </p>
                  </div>
                  <StatusChip status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AppLayout>
  );
}
