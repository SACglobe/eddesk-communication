import type { ReactNode } from "react";

export type MessageStatus = "queued" | "sending" | "delivered" | "read" | "failed" | "sent" | "undelivered";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-1.5 font-display text-[28px] font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface p-6 ${className}`}>
      {title ? (
        <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[15px] font-semibold">{title}</h2>
            {hint ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const statusStyles: Record<MessageStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  sending: "bg-info/10 text-info",
  sent: "bg-info/10 text-info",
  delivered: "bg-success/10 text-success",
  read: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  undelivered: "bg-destructive/10 text-destructive",
};

export function StatusChip({ status }: { status: MessageStatus | string }) {
  const normalizedStatus = (status?.toLowerCase() || "sent") as MessageStatus;
  const style = statusStyles[normalizedStatus] || statusStyles.sent;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${style}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {normalizedStatus}
    </span>
  );
}

export function Metric({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="surface p-5">
      <p className="text-eyebrow">{label}</p>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
