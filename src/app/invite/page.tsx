"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send as SendIcon, Coins, Search, RefreshCw, Check, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader, Panel, StatusChip } from "@/components/ui-kit";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastContext";
import { getTwilioFailureReason } from "@/lib/twilio-errors";

const BATCH = 20; // numbers per request (the API accepts up to 25)

type Tab = "send" | "history";

interface Parent {
  mobile: string; // 10 digits
  students: string[];
  classes: string[]; // distinct class / section labels of the children
  valid: boolean;
}

interface InviteLog {
  id: string;
  studentName: string;
  mobile: string;
  classSec: string;
  status: string;
  createdAt: string;
  errorCode?: string;
  errorMessage?: string;
}

function capitalizeWords(str: string): string {
  return (str || "").replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanMobile(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function isValidMobile(m: string): boolean {
  return /^[6-9]\d{9}$/.test(m);
}

function formatMobile(m: string): string {
  return m.length === 10 ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : m || "No number";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function inviteLines(schoolName: string): string[] {
  return [
    `🎓 *${schoolName}* 🎓`,
    "",
    "Dear Parent,",
    "",
    "We now have our own parent app. Stay connected with your child's school:",
    "",
    "📚 Homework and assignments",
    "📢 Notices and announcements",
    "📝 Requests and leave",
    "🏆 Rank cards and results",
    "",
    "👇 Tap *Download app* below to get started.",
    "",
    "Thank you!",
  ];
}

export default function InviteParentsPage() {
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("send");
  const [activeMobileTab, setActiveMobileTab] = useState<"form" | "preview">("form");

  const [schoolName, setSchoolName] = useState("Your School");
  const [appReady, setAppReady] = useState<boolean | null>(null); // the school has a slug and a download link
  const [credits, setCredits] = useState<number | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [students, setStudents] = useState<{ name: string; mobile: string; classSec: string }[]>([]);
  const [selectedClass, setSelectedClass] = useState(""); // "" = pick a class first
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<InviteLog[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [page, setPage] = useState(1);

  const [confirming, setConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // ---- data ----
  const loadHistory = useCallback(async () => {
    if (!schoolKey) return;
    setHistoryLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("app_invite_history")
      .select("id, studentname, mobile, classsec, status, created_at, error_code, error_message")
      .eq("schoolkey", schoolKey)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      setHistoryError(error.message);
      setHistory([]);
    } else {
      setHistoryError(null);
      setHistory(
        (data ?? []).map((r) => ({
          id: String(r.id),
          studentName: r.studentname ?? "",
          mobile: r.mobile ?? "",
          classSec: r.classsec ?? "",
          status: r.status ?? "sent",
          createdAt: r.created_at,
          errorCode: r.error_code ?? undefined,
          errorMessage: r.error_message ?? undefined,
        })),
      );
    }
    setHistoryLoading(false);
  }, [schoolKey]);

  useEffect(() => {
    if (!isAuthorized || !schoolKey) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [school, sub, studentRows] = await Promise.all([
        supabase.from("schools").select("name, slug, androidurl, iosurl").eq("key", schoolKey).maybeSingle(),
        supabase.from("subscriptions").select("whatsappcredit").eq("schoolkey", schoolKey).maybeSingle(),
        supabase
          .from("students")
          .select("studentname, mobile, classsec")
          .eq("schoolkey", schoolKey)
          .order("studentname", { ascending: true })
          .limit(10000),
      ]);
      if (cancelled) return;
      if (school.data?.name) setSchoolName(school.data.name);
      setAppReady(Boolean(school.data?.slug && (school.data.androidurl || school.data.iosurl)));
      setCredits(sub.data?.whatsappcredit ?? 0);
      setStudents(
        (studentRows.data ?? []).map((s) => ({
          name: capitalizeWords(s.studentname ?? ""),
          mobile: cleanMobile(s.mobile),
          classSec: (s.classsec ?? "").trim(),
        })),
      );
      setDataLoaded(true);
    })();
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized, schoolKey, loadHistory]);

  useEffect(() => {
    const onCredits = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "number") setCredits(detail);
    };
    window.addEventListener("credits_updated", onCredits);
    return () => window.removeEventListener("credits_updated", onCredits);
  }, []);

  // ---- classes and parents ----
  const classOptions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of students) {
      const label = s.classSec || "No class";
      if (!map.has(label)) map.set(label, new Set());
      if (isValidMobile(s.mobile)) map.get(label)!.add(s.mobile);
    }
    return Array.from(map.entries())
      .map(([label, numbers]) => ({ label, parents: numbers.size }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [students]);

  // One row per mobile number: brothers and sisters share a number and get one invite.
  const parents = useMemo<Parent[]>(() => {
    const inClass = selectedClass === "ALL" ? students : students.filter((s) => (s.classSec || "No class") === selectedClass);
    const byMobile = new Map<string, Parent>();
    for (const s of inClass) {
      const key = s.mobile || `none-${s.name}-${s.classSec}`;
      let p = byMobile.get(key);
      if (!p) {
        p = { mobile: s.mobile, students: [], classes: [], valid: isValidMobile(s.mobile) };
        byMobile.set(key, p);
      }
      if (s.name && !p.students.includes(s.name)) p.students.push(s.name);
      const label = s.classSec || "No class";
      if (!p.classes.includes(label)) p.classes.push(label);
    }
    return Array.from(byMobile.values()).sort((a, b) => (a.students[0] ?? "").localeCompare(b.students[0] ?? ""));
  }, [students, selectedClass]);

  // numbers already invited (a send that did not fail), with the latest date
  const invitedOn = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of history) {
      if (h.status === "failed" || h.status === "undelivered") continue;
      if (!m.has(h.mobile)) m.set(h.mobile, h.createdAt);
    }
    return m;
  }, [history]);

  const visibleParents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter((p) => p.mobile.includes(q) || p.students.some((n) => n.toLowerCase().includes(q)));
  }, [parents, search]);

  const selectableVisible = visibleParents.filter((p) => p.valid);
  const selectedCount = parents.filter((p) => p.valid && selected.has(p.mobile)).length;

  const chooseClass = (value: string) => {
    setSelectedClass(value);
    setSearch("");
    setConfirming(false);
    // Start with everyone who has not been invited yet; the person can tick or untick any number.
    const list = value === "ALL" ? students : students.filter((s) => (s.classSec || "No class") === value);
    const next = new Set<string>();
    for (const s of list) if (isValidMobile(s.mobile) && !invitedOn.has(s.mobile)) next.add(s.mobile);
    setSelected(next);
  };

  const toggle = (mobile: string) => {
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mobile)) next.delete(mobile);
      else next.add(mobile);
      return next;
    });
  };

  const selectAllVisible = () => {
    setConfirming(false);
    setSelected((prev) => new Set([...prev, ...selectableVisible.map((p) => p.mobile)]));
  };
  const clearVisible = () => {
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visibleParents) next.delete(p.mobile);
      return next;
    });
  };

  // ---- sending ----
  const canSend = appReady === true && selectedCount > 0 && credits !== null && credits >= selectedCount && !isSending;

  const send = async () => {
    const chosen = parents.filter((p) => p.valid && selected.has(p.mobile));
    if (chosen.length === 0) return;
    setConfirming(false);
    setIsSending(true);
    setProgress({ done: 0, total: chosen.length });

    let sent = 0;
    let failed = 0;
    let stopReason: string | null = null;
    const sentNumbers = new Set<string>();

    for (let i = 0; i < chosen.length; i += BATCH) {
      const slice = chosen.slice(i, i + BATCH);
      try {
        const res = await fetch("/api/send-app-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: slice.map((p) => ({
              mobile: p.mobile,
              studentName: p.students.join(", "),
              classSec: p.classes.join(", "),
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          stopReason = data.error || "Could not send the invites.";
          break;
        }
        sent += data.sent;
        failed += data.failed;
        for (const r of data.results as { mobile: string; ok: boolean }[]) if (r.ok) sentNumbers.add(r.mobile);
        setCredits(data.creditsLeft);
        window.dispatchEvent(new CustomEvent("credits_updated", { detail: data.creditsLeft }));
      } catch {
        stopReason = "Network problem. Check History to see which invites went out.";
        break;
      }
      setProgress({ done: Math.min(chosen.length, i + slice.length), total: chosen.length });
    }

    setIsSending(false);
    setSelected((prev) => {
      const next = new Set(prev);
      sentNumbers.forEach((m) => next.delete(m));
      return next;
    });
    await loadHistory();

    if (stopReason) {
      showToast(`${sent} sent before it stopped. ${stopReason}`, "error", "Invites stopped");
    } else if (failed > 0) {
      showToast(`${sent} invites sent, ${failed} could not be sent. See History for the reasons.`, "warning", "Invites sent");
    } else {
      showToast(`${sent} invite${sent === 1 ? "" : "s"} sent. Delivery is tracked in History.`, "success", "Invites sent");
    }
  };

  // ---- history view ----
  const historyCounts = useMemo(() => {
    const c = { total: history.length, delivered: 0, failed: 0 };
    for (const h of history) {
      if (h.status === "delivered" || h.status === "read") c.delivered++;
      else if (h.status === "failed" || h.status === "undelivered") c.failed++;
    }
    return c;
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return history.filter((h) => {
      if (statusFilter === "failed" && !(h.status === "failed" || h.status === "undelivered")) return false;
      if (statusFilter === "delivered" && !(h.status === "delivered" || h.status === "read")) return false;
      if (statusFilter === "pending" && !["queued", "sending", "sent", "accepted"].includes(h.status)) return false;
      if (!q) return true;
      return h.mobile.includes(q) || h.studentName.toLowerCase().includes(q) || h.classSec.toLowerCase().includes(q);
    });
  }, [history, statusFilter, historyQuery]);

  const PAGE_SIZE = 20;
  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const pageRows = filteredHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [statusFilter, historyQuery]);

  if (accessError) return <AccessDenied type={accessError} />;
  if (isLoading || !isAuthorized) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const noStudents = dataLoaded && students.length === 0;
  const lacksCredits = credits !== null && selectedCount > 0 && credits < selectedCount;

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Parent app"
          title="Invite parents to the app"
          description="Choose a class, tick the parents to invite, and send the app download link on WhatsApp."
        />

        {/* Send / History toggle */}
        <div role="tablist" className="inline-flex rounded-xl bg-muted/60 p-1">
          {(
            [
              ["send", "Send invites"],
              ["history", `History${historyCounts.total ? ` (${historyCounts.total})` : ""}`],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "send" && (
          <>
            {appReady === false && (
              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/50 p-4 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p>
                  Your school&apos;s app download link is not set up yet, so invites are switched off. Contact EdDesk support to
                  activate it.
                </p>
              </div>
            )}

            {/* Mobile View Switcher */}
            <div className="flex rounded-xl bg-muted/60 p-1 xl:hidden">
              {(
                [
                  ["form", "👨‍👩‍👧 Choose parents"],
                  ["preview", "💬 Live WhatsApp Preview"],
                ] as ["form" | "preview", string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMobileTab(key)}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                    activeMobileTab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,420px)]">
              <div className={`${activeMobileTab === "form" ? "block" : "hidden xl:block"} space-y-5`}>
                <Panel>
                  <label className="block">
                    <span className="text-eyebrow">Class *</span>
                    <select
                      value={selectedClass}
                      onChange={(e) => chooseClass(e.target.value)}
                      disabled={!dataLoaded || noStudents}
                      className="mt-1.5 w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:opacity-60"
                    >
                      <option value="">{dataLoaded ? (noStudents ? "No students yet" : "Select a class") : "Loading classes…"}</option>
                      {classOptions.length > 1 && (
                        <option value="ALL">All classes ({new Set(students.map((s) => s.mobile).filter(isValidMobile)).size} parents)</option>
                      )}
                      {classOptions.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label} ({c.parents} parent{c.parents === 1 ? "" : "s"})
                        </option>
                      ))}
                    </select>
                  </label>
                  {noStudents && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Parents appear here after you add students in Manage Classes or send a report card.
                    </p>
                  )}
                </Panel>

                {selectedClass && (
                  <Panel
                    title="Parents"
                    hint={`${selectedCount} selected of ${parents.filter((p) => p.valid).length} with a valid number`}
                    action={
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={selectAllVisible} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
                          Select all
                        </button>
                        <button type="button" onClick={clearVisible} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent">
                          Clear
                        </button>
                      </div>
                    }
                  >
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by student name or mobile number"
                        className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-3.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
                      />
                    </div>

                    <ul className="mt-4 max-h-[460px] divide-y divide-border overflow-y-auto rounded-xl border border-border">
                      {visibleParents.length === 0 && (
                        <li className="px-4 py-6 text-center text-sm text-muted-foreground">No parents match.</li>
                      )}
                      {visibleParents.map((p) => {
                        const key = p.mobile || p.students.join();
                        const checked = p.valid && selected.has(p.mobile);
                        const invited = invitedOn.get(p.mobile);
                        return (
                          <li key={key}>
                            <label
                              className={`flex items-center gap-3 px-4 py-3 text-sm ${
                                p.valid ? "cursor-pointer hover:bg-accent/60" : "cursor-not-allowed opacity-60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!p.valid}
                                onChange={() => toggle(p.mobile)}
                                className="size-4 shrink-0 accent-[var(--whatsapp,#25d366)]"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{p.students.join(", ") || "Parent"}</span>
                                <span className="block text-xs text-muted-foreground tabular-nums">
                                  {p.valid ? formatMobile(p.mobile) : p.mobile ? `${p.mobile} is not a valid mobile number` : "No mobile number"}
                                </span>
                              </span>
                              {selectedClass === "ALL" && (
                                <span className="hidden shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary sm:inline">
                                  {p.classes.join(", ")}
                                </span>
                              )}
                              {invited && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                                  <Check className="size-3" /> Invited {new Date(invited).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Brothers and sisters with the same number get one invite. Parents already invited start unticked.
                    </p>
                  </Panel>
                )}
              </div>

              <div className={`${activeMobileTab === "preview" ? "block" : "hidden xl:block"} space-y-4 xl:sticky xl:top-24 xl:self-start`}>
                <p className="text-eyebrow">Live WhatsApp preview</p>
                <WhatsAppPreview lines={inviteLines(schoolName)} recipient="Parent" buttonLabel="Download app" />

                <div className="surface p-5">
                  <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Coins className="size-4 text-primary" strokeWidth={2} />
                      1 credit per invite
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {credits !== null ? credits.toLocaleString() : "..."} credits left
                    </span>
                  </div>

                  {isSending ? (
                    <div className="mt-4" aria-live="polite">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-whatsapp transition-all"
                          style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="mt-2 text-center text-xs text-muted-foreground tabular-nums">
                        Sending… {progress.done} of {progress.total}. Keep this page open.
                      </p>
                    </div>
                  ) : confirming ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm">
                        Send the invite to <b>{selectedCount}</b> parent{selectedCount === 1 ? "" : "s"}? This uses <b>{selectedCount}</b> credit
                        {selectedCount === 1 ? "" : "s"}.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={send}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card"
                        >
                          <SendIcon className="size-4" strokeWidth={2.2} /> Yes, send
                        </button>
                        <button type="button" onClick={() => setConfirming(false)} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-accent">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      disabled={!canSend}
                      onClick={() => setConfirming(true)}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <SendIcon className="size-4" strokeWidth={2.2} />
                      {selectedCount > 0 ? `Send to ${selectedCount} parent${selectedCount === 1 ? "" : "s"}` : "Send invites"}
                    </button>
                  )}

                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    {appReady === false
                      ? "The app download link is not set up yet."
                      : !selectedClass
                      ? "Select a class to see its parents."
                      : selectedCount === 0
                      ? "Tick at least one parent."
                      : lacksCredits
                      ? `Not enough credits: ${selectedCount} needed. Top up to send.`
                      : "Delivery is tracked in History."}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "history" && (
          <Panel
            title="Invite history"
            hint="Every invite sent from this page"
            action={
              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${historyLoading ? "animate-spin" : ""}`} /> Refresh
              </button>
            }
          >
            {historyError ? (
              <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                Invite history is not available yet. If this keeps showing, contact EdDesk support.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Sent", historyCounts.total],
                    ["Delivered", historyCounts.delivered],
                    ["Failed", historyCounts.failed],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-xl bg-muted/50 p-4">
                      <p className="text-eyebrow">{label}</p>
                      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                      placeholder="Search by student, class or mobile"
                      className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-3.5 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium outline-none"
                  >
                    <option value="">All statuses</option>
                    <option value="delivered">Delivered or read</option>
                    <option value="pending">On the way</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
                  {pageRows.length === 0 && (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {history.length === 0 ? "No invites sent yet." : "No invites match these filters."}
                    </li>
                  )}
                  {pageRows.map((h) => {
                    const failed = h.status === "failed" || h.status === "undelivered";
                    return (
                      <li key={h.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{h.studentName || "Parent"}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {formatMobile(h.mobile)}
                            {h.classSec ? ` · ${h.classSec}` : ""} · {formatDate(h.createdAt)}
                          </p>
                          {failed && (
                            <p className="mt-1 text-xs text-destructive">{getTwilioFailureReason(h.errorCode, h.errorMessage)}</p>
                          )}
                        </div>
                        <StatusChip status={h.status} />
                      </li>
                    );
                  })}
                </ul>

                {pageCount > 1 && (
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Page {page} of {pageCount} · {filteredHistory.length} invites
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-accent disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= pageCount}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-accent disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Panel>
        )}
      </div>
    </AppLayout>
  );
}
