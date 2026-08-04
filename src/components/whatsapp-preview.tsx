import { Bar } from "@/components/ui-kit";
import { CheckCheck } from "lucide-react";

function renderFormattedText(text: string) {
  const segments = text.split(/(\*[^*]+\*)/g);
  return segments.map((segment, i) => {
    if (segment.startsWith("*") && segment.endsWith("*")) {
      return <strong key={i}>{segment.slice(1, -1)}</strong>;
    }
    return <span key={i}>{segment}</span>;
  });
}

/** WhatsApp-accurate preview of the outgoing message. */
export function WhatsAppPreview({
  lines,
  recipient = "Parent",
  time = "9:12 AM",
}: {
  lines: string[];
  recipient?: string;
  time?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-3 bg-whatsapp px-4 py-3 text-primary-foreground">
        <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/20 text-[11px] font-semibold">
          {recipient
            ? recipient
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
            : "P"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{recipient || "Parent"}</p>
          <p className="truncate text-[11px] opacity-80">online</p>
        </div>
      </div>

      <div className="whatsapp-thread space-y-2 px-4 py-5">
        <div className="ml-auto max-w-[86%] rounded-2xl rounded-tr-md bg-whatsapp-bubble px-3.5 py-2.5 shadow-card">
          <div className="space-y-1 text-[13px] leading-relaxed text-foreground">
            {lines.map((line, i) =>
              line === "" ? (
                <div key={i} className="h-2" />
              ) : (
                <p key={i} className={i === 0 ? "font-semibold" : undefined}>
                  {renderFormattedText(line)}
                </p>
              ),
            )}
          </div>
          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            {time}
            <CheckCheck className="size-3 text-info" strokeWidth={2.4} />
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProgressStat({ label, value, caption }: { label: string; value: number; caption?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm">{label}</p>
        <p className="text-sm font-medium tabular-nums">{value}%</p>
      </div>
      <Bar value={value} />
      {caption ? <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
