"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronDown,
  X,
  RotateCcw,
  Check,
  Clock,
  Send,
  Eye,
  AlertTriangle,
  Filter,
  Calendar,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader, Panel, StatusChip } from "@/components/ui-kit";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { createClient } from "@/lib/supabase/client";
import { getTwilioFailureReason } from "@/lib/twilio-errors";

interface HistoryLog {
  id: string;
  studentName: string;
  mobile: string;
  classSec: string;
  examName: string;
  message: string;
  status: string;
  timestamp: string;
  rawDate: string;
  senderEmail?: string;
  errorCode?: string;
  errorMessage?: string;
}

function formatPhoneReadable(phone: string): string {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("91") && clean.length === 12) {
    clean = clean.substring(2);
  }
  if (clean.length === 10) {
    return `+91 ${clean.substring(0, 5)} ${clean.substring(5)}`;
  }
  return phone.startsWith("+") ? phone : `+91 ${phone}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const [history, setHistory] = useState<HistoryLog[]>([]);
  
  // Filters
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchHistory = async () => {
    const supabase = createClient();

    let historyQuery = supabase
      .from("report_card_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (schoolKey) {
      historyQuery = historyQuery.eq("schoolkey", schoolKey);
    }

    let { data, error } = await historyQuery;

    // Fallback if empty or RLS restriction on schoolkey
    if ((!data || data.length === 0) && schoolKey) {
      const { data: fallbackData } = await supabase
        .from("report_card_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (fallbackData && fallbackData.length > 0) {
        data = fallbackData;
      }
    }

    if (data) {
      const formatted: HistoryLog[] = data.map((item) => ({
        id: item.id.toString(),
        studentName: item.studentname,
        mobile: item.mobile,
        classSec: item.classsec,
        examName: item.examname,
        message: item.message,
        status: item.status || "sent",
        timestamp: new Date(item.created_at).toLocaleString(),
        rawDate: item.created_at || new Date().toISOString(),
        senderEmail: item.sender_email,
        errorCode: item.error_code,
        errorMessage: item.error_message,
      }));
      setHistory(formatted);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchHistory();
    }
  }, [isAuthorized, schoolKey]);

  const syncTwilioStatuses = async () => {
    try {
      const res = await fetch("/api/cron/sync-twilio-status", { method: "POST" });
      const syncData = await res.json();
      if (syncData && Array.isArray(syncData.updates) && syncData.updates.length > 0) {
        const updateMap = new Map(syncData.updates.map((u: any) => [u.id.toString(), u]));
        setHistory((prev) =>
          prev.map((item) => {
            const upd: any = updateMap.get(item.id);
            if (upd) {
              return {
                ...item,
                status: upd.newStatus,
                errorCode: upd.errorCode,
                errorMessage: upd.errorMessage,
              };
            }
            return item;
          })
        );
      }
    } catch (e) {
      console.error("Auto sync failed:", e);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncTwilioStatuses();
      await fetchHistory();
    } catch (e) {
      console.error("Manual sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // 1. Text Search Filter
      const matchesSearch =
        !query.trim() ||
        item.studentName.toLowerCase().includes(query.toLowerCase().trim()) ||
        item.mobile.includes(query.trim()) ||
        item.classSec.toLowerCase().includes(query.toLowerCase().trim());

      // 2. Class Filter
      const matchesClass =
        !classFilter || item.classSec.split(" ")[0] === classFilter;

      // 3. Status Filter
      const matchesStatus =
        !statusFilter ||
        item.status.toLowerCase() === statusFilter.toLowerCase();

      // 4. Date Range Filter
      let matchesDate = true;
      const itemDate = new Date(item.rawDate);
      const now = new Date();

      if (datePreset === "today") {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        matchesDate = itemDate >= todayStart;
      } else if (datePreset === "yesterday") {
        const yestStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yestEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        matchesDate = itemDate >= yestStart && itemDate < yestEnd;
      } else if (datePreset === "7days") {
        const d7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = itemDate >= d7Start;
      } else if (datePreset === "30days") {
        const d30Start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = itemDate >= d30Start;
      } else if (datePreset === "custom") {
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && itemDate >= s;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && itemDate <= e;
        }
      }

      return matchesSearch && matchesClass && matchesStatus && matchesDate;
    });
  }, [history, query, classFilter, statusFilter, datePreset, startDate, endDate]);

  const isAnyFilterActive =
    query !== "" ||
    classFilter !== "" ||
    statusFilter !== "" ||
    datePreset !== "all" ||
    startDate !== "" ||
    endDate !== "";

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, classFilter, statusFilter, datePreset, startDate, endDate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(filteredHistory.length, startIndex + pageSize);

  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(startIndex, endIndex);
  }, [filteredHistory, startIndex, endIndex]);

  // Auto-sync Twilio status whenever queued/pending messages exist on the current page
  useEffect(() => {
    if (paginatedHistory.length > 0) {
      const hasQueuedOrPending = paginatedHistory.some((m) =>
        ["queued", "sending", "sent"].includes(m.status.toLowerCase())
      );
      if (hasQueuedOrPending) {
        syncTwilioStatuses();
      }
    }
  }, [paginatedHistory]);

  const uniqueClasses = Array.from(
    new Set(history.map((item) => item.classSec.split(" ")[0]))
  ).sort();

  const active = history.find((m) => m.id === openId) ?? null;

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
      <div className="space-y-8">
        <PageHeader
          eyebrow="History"
          title="Message history"
          description="Every send, with real-time delivery state per recipient. Click any row for the full timeline."
        />

        <Panel className="p-0">
          <div className="flex flex-col gap-3.5 border-b border-border p-4 sm:p-5">
            {/* Top Row: Search + Sync */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-muted/60 px-3.5 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-background">
                <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by student name, phone or class…"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </label>

              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-medium outline-none transition-colors hover:border-primary/40 disabled:opacity-50 shrink-0"
              >
                <RotateCcw className={`size-3.5 ${isSyncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                <span>{isSyncing ? "Syncing..." : "Sync Statuses"}</span>
              </button>
            </div>

            {/* Filter Controls Row: Class, Status, Date Range */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground pr-1">
                <Filter className="size-3.5 text-muted-foreground" />
                Filters:
              </span>

              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium outline-none transition-colors hover:border-primary/40"
              >
                <option value="">All Classes</option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium outline-none transition-colors hover:border-primary/40"
              >
                <option value="">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="read">Read</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed / Undelivered</option>
              </select>

              {/* Date Filter Preset */}
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium outline-none transition-colors hover:border-primary/40"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>

              {/* Custom Date Pickers */}
              {datePreset === "custom" && (
                <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl border border-border/80 text-xs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium outline-none"
                  />
                  <span className="text-muted-foreground font-semibold">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium outline-none"
                  />
                </div>
              )}

              {/* Clear All Filters */}
              {isAnyFilterActive && (
                <button
                  onClick={() => {
                    setQuery("");
                    setClassFilter("");
                    setStatusFilter("");
                    setDatePreset("all");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="flex items-center gap-1 rounded-xl border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20 ml-auto sm:ml-0"
                >
                  <X className="size-3" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_130px_140px] items-center gap-4 px-5 py-3 text-eyebrow border-b border-border/60 md:grid">
            <span>Student &amp; Exam</span>
            <span>Class</span>
            <span>Mobile</span>
            <span className="text-center">Whatsapp Status</span>
            <span className="text-right">Date &amp; Time</span>
          </div>

          <ul className="divide-y divide-border">
            {paginatedHistory.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setOpenId(m.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/60 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_130px_140px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{m.studentName}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {m.examName} · {m.senderEmail || "School"}
                    </span>
                    {(m.status === "failed" || m.status === "undelivered") && (
                      <span className="mt-1 block truncate text-[11px] font-medium text-destructive">
                        Reason: {getTwilioFailureReason(m.errorCode, m.errorMessage)}
                      </span>
                    )}
                  </span>
                  <span className="hidden truncate text-sm font-medium text-foreground md:block">{m.classSec}</span>
                  <span className="hidden text-sm font-medium tabular-nums text-foreground md:block">
                    {formatPhoneReadable(m.mobile)}
                  </span>
                  <div className="hidden justify-center md:flex">
                    <StatusChip status={m.status} />
                  </div>
                  <div className="flex items-center justify-between md:justify-end">
                    <div className="md:hidden">
                      <StatusChip status={m.status} />
                    </div>
                    <span className="hidden whitespace-nowrap text-xs text-muted-foreground md:block text-right">
                      {m.timestamp}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {filteredHistory.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Search className="size-5" strokeWidth={1.8} />
              </span>
              <p className="font-display text-base font-semibold">No messages found</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Try searching by student name, phone number, status, or date range.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setClassFilter("");
                  setStatusFilter("");
                  setDatePreset("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="mt-1 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Clear search &amp; filters
              </button>
            </div>
          )}

          {/* Pagination Controls Bar */}
          {filteredHistory.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-border px-5 py-4 sm:flex-row">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  Showing <strong className="font-semibold text-foreground">{filteredHistory.length > 0 ? startIndex + 1 : 0}</strong>–
                  <strong className="font-semibold text-foreground">{endIndex}</strong> of{" "}
                  <strong className="font-semibold text-foreground">{filteredHistory.length}</strong> messages
                </span>
                <span className="hidden sm:inline">·</span>
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-lg border border-border bg-card px-2 py-1 text-xs font-semibold outline-none focus:border-primary/40"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                  .map((page, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;

                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`size-7 rounded-lg text-xs font-semibold transition-colors ${
                            currentPage === page
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "border border-border hover:bg-accent text-foreground"
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Panel>

        {active && (
          <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-sm">
            <button className="flex-1" aria-label="Close" onClick={() => setOpenId(null)} />
            <aside className="h-full w-full max-w-xl overflow-y-auto bg-background p-7 shadow-pop sm:rounded-l-3xl">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <p className="text-eyebrow">Report Card Details</p>
                  <h2 className="mt-1 font-display text-xl font-semibold">{active.studentName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {active.classSec} · {active.examName}
                  </p>
                </div>
                <button
                  onClick={() => setOpenId(null)}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-accent"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <StatusChip status={active.status} />
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {formatPhoneReadable(active.mobile)}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {active.timestamp}
                </span>
              </div>

              {(active.status === "failed" || active.status === "undelivered") && (
                <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
                  <div className="flex items-start gap-2.5 font-semibold text-destructive">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">Message Delivery Failure Reason</p>
                      <p className="mt-1 font-normal text-xs leading-relaxed text-destructive/90">
                        {getTwilioFailureReason(active.errorCode, active.errorMessage)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <h3 className="mt-8 text-eyebrow">Delivery timeline</h3>
              <ol className="mt-4 space-y-5 border-l-2 border-border pl-4">
                <li className="relative">
                  <span className="absolute -left-[21px] top-0.5 grid size-2.5 place-items-center rounded-full bg-primary ring-4 ring-background" />
                  <p className="text-xs font-semibold">Accepted by provider</p>
                  <p className="text-[11px] text-muted-foreground">{active.timestamp}</p>
                </li>
                <li className="relative">
                  <span className="absolute -left-[21px] top-0.5 grid size-2.5 place-items-center rounded-full bg-primary ring-4 ring-background" />
                  <p className="text-xs font-semibold">Sent to WhatsApp network</p>
                  <p className="text-[11px] text-muted-foreground">{active.timestamp}</p>
                </li>
                {active.status === "delivered" || active.status === "read" ? (
                  <li className="relative">
                    <span className="absolute -left-[21px] top-0.5 grid size-2.5 place-items-center rounded-full bg-success ring-4 ring-background" />
                    <p className="text-xs font-semibold text-success">Delivered to handset</p>
                    <p className="text-[11px] text-muted-foreground">{active.timestamp}</p>
                  </li>
                ) : null}
                {active.status === "read" ? (
                  <li className="relative">
                    <span className="absolute -left-[21px] top-0.5 grid size-2.5 place-items-center rounded-full bg-primary ring-4 ring-background" />
                    <p className="text-xs font-semibold text-primary">Read by parent</p>
                    <p className="text-[11px] text-muted-foreground">{active.timestamp}</p>
                  </li>
                ) : null}
                {active.status === "failed" || active.status === "undelivered" ? (
                  <li className="relative">
                    <span className="absolute -left-[21px] top-0.5 grid size-2.5 place-items-center rounded-full bg-destructive ring-4 ring-background" />
                    <p className="text-xs font-semibold text-destructive">Delivery Failed</p>
                    <p className="text-[11px] text-destructive/80">
                      {getTwilioFailureReason(active.errorCode, active.errorMessage)}
                    </p>
                  </li>
                ) : null}
              </ol>

              <h3 className="mt-8 text-eyebrow">Message content sent</h3>
              <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card p-4">
                <WhatsAppPreview
                  lines={active.message ? active.message.split("\n") : []}
                  recipient={active.studentName}
                  time={active.timestamp}
                />
              </div>

              <div className="mt-7 flex items-center justify-between border-t border-border pt-5">
                <button
                  type="button"
                  onClick={() => {
                    const draft = {
                      studentName: active.studentName,
                      mobile: active.mobile,
                      classSec: active.classSec,
                      examName: active.examName,
                    };
                    localStorage.setItem("resend_draft", JSON.stringify(draft));
                    router.push("/send");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                >
                  <Send className="size-3.5" />
                  <span>Resend / Edit Report Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
