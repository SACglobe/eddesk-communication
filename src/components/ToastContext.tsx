"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

type ToastListener = (toast: ToastItem) => void;
const listeners: Set<ToastListener> = new Set();

export function showToast(message: string, type: ToastType = "info", title?: string) {
  const id = Math.random().toString(36).substring(2, 9);
  const toast: ToastItem = { id, message, type, title };
  listeners.forEach((fn) => fn(toast));
}

if (typeof window !== "undefined") {
  (window as any).showToast = showToast;
}

export function useToast() {
  return { showToast };
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleNewToast = (toast: ToastItem) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4500);
    };

    const handleCustomToast = (e: any) => {
      if (e.detail?.message) {
        handleNewToast({
          id: Math.random().toString(36).substring(2, 9),
          message: e.detail.message,
          type: e.detail.type || "info",
          title: e.detail.title,
        });
      }
    };

    window.addEventListener("toast", handleCustomToast);
    listeners.add(handleNewToast);

    return () => {
      window.removeEventListener("toast", handleCustomToast);
      listeners.delete(handleNewToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 pointer-events-none p-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3.5 rounded-2xl p-5 shadow-2xl border backdrop-blur-xl transition-all duration-300 transform scale-100 animate-in fade-in zoom-in-95 max-w-md w-full ${
            toast.type === "success"
              ? "bg-card/98 border-success/40 text-foreground ring-1 ring-success/30 shadow-success/15"
              : toast.type === "error"
              ? "bg-card border-destructive/50 text-foreground ring-1 ring-destructive/30 shadow-destructive/15"
              : toast.type === "warning"
              ? "bg-card/98 border-amber-500/40 text-foreground ring-1 ring-amber-500/30"
              : "bg-card/98 border-border text-foreground ring-1 ring-border/50"
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === "success" && <CheckCircle2 className="size-5 text-success" strokeWidth={2.2} />}
            {toast.type === "error" && <AlertCircle className="size-5 text-destructive" strokeWidth={2.2} />}
            {toast.type === "warning" && <AlertTriangle className="size-5 text-amber-500" strokeWidth={2.2} />}
            {toast.type === "info" && <Info className="size-5 text-primary" strokeWidth={2.2} />}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {toast.title || (toast.type === "success" ? "Success" : toast.type === "error" ? "Alert" : "Notification")}
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5 leading-snug">
              {toast.message}
            </p>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close notification"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
