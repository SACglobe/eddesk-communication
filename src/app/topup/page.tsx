"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Coins, Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader } from "@/components/ui-kit";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const quick = [100, 500, 1000, 5000];
const RATE = 1;

export default function CreditsPage() {
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const { showToast } = useToast();
  const [credits, setCredits] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(500);
  const [inputValue, setInputValue] = useState<string>("500");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleanDigits = raw.replace(/\D/g, "").replace(/^0+/, "");
    setInputValue(cleanDigits);
    const parsed = parseInt(cleanDigits, 10);
    setAmount(isNaN(parsed) ? 0 : parsed);
  };

  const handleInputBlur = () => {
    if (!inputValue || parseInt(inputValue, 10) < 1) {
      setInputValue("1");
      setAmount(1);
    } else {
      const parsed = parseInt(inputValue, 10);
      setInputValue(parsed.toString());
      setAmount(parsed);
    }
  };

  useEffect(() => {
    async function loadCredits() {
      if (!schoolKey) return;
      const supabase = createClient();
      const { data } = await supabase
        .from("subscriptions")
        .select("whatsappcredit")
        .eq("schoolkey", schoolKey)
        .maybeSingle();

      if (data && data.whatsappcredit !== null) {
        setCredits(data.whatsappcredit);
      }
    }

    if (isAuthorized) {
      loadCredits();
    }
  }, [isAuthorized, schoolKey]);

  const handleTopup = async () => {
    if (!amount || amount <= 0) return;
    setIsProcessing(true);

    try {
      const res = await fetch("/api/subscription/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * RATE * 100,
          planName: `${amount} WhatsApp Credits Topup`,
          planKey: "topup",
          type: "whatsapp_topup",
          schoolKey,
        }),
      });

      const order = await res.json();
      if (!res.ok || !order.id) {
        throw new Error(order.error || "Failed to create payment order.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "EdDesk Communication",
        description: `Topup ${amount.toLocaleString()} WhatsApp Credits`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/subscription/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: amount,
                type: "whatsapp_topup",
                schoolKey: schoolKey,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              const newBalance = (credits ?? 0) + amount;
              setCredits(newBalance);
              window.dispatchEvent(new CustomEvent("credits_updated", { detail: newBalance }));
              showToast(`${amount.toLocaleString()} credits added successfully! New balance: ${newBalance.toLocaleString()}`, "success", "Topup Successful");
            } else {
              showToast("Payment verification failed.", "error");
            }
          } catch (err) {
            console.error("Verification Error:", err);
            showToast("An error occurred verifying payment.", "error");
          } finally {
            setIsProcessing(false);
          }
        },
        theme: { color: "#3B82F6" },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (resp: any) {
        showToast("Payment Failed: " + resp.error.description, "error");
        setIsProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      showToast(err.message || "Payment initialization failed.", "error");
      setIsProcessing(false);
    }
  };

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
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="space-y-10">
        <PageHeader
          eyebrow="Billing"
          title="Credits"
          description="One credit sends one report card. Top up any amount — credits never expire."
        />

        <section className="max-w-2xl space-y-6">
          <div className="surface flex flex-wrap items-center justify-between gap-4 bg-primary-soft/60 px-6 py-5">
            <div>
              <p className="text-eyebrow">Available credits</p>
              <p className="font-display text-4xl font-semibold tabular-nums">
                {credits !== null ? credits.toLocaleString() : "..."}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              = {credits !== null ? credits.toLocaleString() : "..."} report cards you can send
            </p>
          </div>

          <div className="surface p-7">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Coins className="size-5" strokeWidth={1.9} />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold">Top up credits</h2>
                <p className="text-sm text-muted-foreground">₹ {RATE.toFixed(2)} per credit</p>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="text-eyebrow">Number of credits</span>
              <span className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 transition-colors focus-within:border-primary/40 focus-within:bg-background">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  placeholder="Enter credits"
                  className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold tabular-nums outline-none"
                />
                <span className="shrink-0 text-sm text-muted-foreground">credits</span>
              </span>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              {quick.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInputValue(q.toString());
                    setAmount(q);
                  }}
                  className={[
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    amount === q
                      ? "border-primary/50 bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  ].join(" ")}
                >
                  +{q.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
              <p className="text-sm text-muted-foreground">Amount payable</p>
              <p className="font-display text-2xl font-semibold tabular-nums">
                ₹ {(amount * RATE).toLocaleString("en-IN")}
              </p>
            </div>

            <button
              disabled={amount < 1 || isProcessing}
              onClick={handleTopup}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45"
            >
              <Plus className="size-4" strokeWidth={2.4} />
              {isProcessing
                ? "Processing Top-up…"
                : `Top up ${amount > 0 ? amount.toLocaleString() : ""} credits`}
            </button>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
