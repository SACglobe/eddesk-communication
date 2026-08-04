"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { Check, Sparkles, Zap, Crown, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader, Panel, Bar } from "@/components/ui-kit";
import { createClient } from "@/lib/supabase/client";
import { calculatePlanPrice } from "@/lib/utils/pricing";
import { useToast } from "@/components/ToastContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PlanItem {
  id?: string;
  key?: string;
  code: string;
  name: string;
  description?: string;
  price: string | number;
  whatsappprice?: string | number;
  billingcycle?: string;
  discount_type?: string;
  discount_flat?: string | number;
  discount_percentage?: number;
  discount_free_months?: number;
  discount_label?: string;
  discount_active?: boolean;
  discount_expires_at?: string | null;
  features?: string | string[];
}

export default function SubscriptionPage() {
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const { showToast } = useToast();
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    async function loadPlansAndSub() {
      if (!schoolKey) return;
      const supabase = createClient();

      // Fetch plans from Supabase plans table
      const { data: plansData } = await supabase
        .from("plans")
        .select("*")
        .order("idx", { ascending: true });

      if (plansData && plansData.length > 0) {
        setPlans(plansData);
      }

      // Fetch current subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("schoolkey", schoolKey)
        .maybeSingle();

      if (sub) {
        setCurrentSub(sub);
      }
    }

    if (isAuthorized) {
      loadPlansAndSub();
    }
  }, [isAuthorized, schoolKey]);

  const excludedFeatures = [
    "Website Template Management",
    "Basic Analytics",
    "Email Support",
    "Everything in Monthly",
    "Priority 24/7 Support",
    "Advanced SEO Tools",
    "Custom Domain Setup",
    "Save with 1 Month Free Included",
    "Unlimited Report Card Generation",
    "Instant Delivery Reports",
    "Top-up credits anytime",
    "Save up to 30% annually",
  ];

  const defaultMonthlyFeatures = [
    "Full Admin Panel Access",
  ];

  const defaultYearlyFeatures = [
    "Full Admin Panel Access",
  ];

  // Identify monthly and yearly plan objects from Supabase
  const monthlyPlanObj = plans.find((p) => p.code === "monthly") || {
    code: "monthly",
    name: "Monthly Plan",
    whatsappprice: 100,
    features: defaultMonthlyFeatures,
  };

  const yearlyPlanObj = plans.find((p) => p.code === "yearly") || {
    code: "yearly",
    name: "Yearly Growth Plan",
    whatsappprice: 1200,
    discount_type: "free_months",
    discount_free_months: 1,
    discount_active: true,
    features: defaultYearlyFeatures,
  };

  const monthlyResult = calculatePlanPrice(monthlyPlanObj);
  const monthlyFinalPrice = monthlyResult.finalPrice || Number(monthlyPlanObj.whatsappprice || 100);

  const yearlyResult = calculatePlanPrice(yearlyPlanObj, monthlyFinalPrice);
  const yearlyFinalPrice = yearlyResult.finalPrice || Number(yearlyPlanObj.whatsappprice || 1200);

  const parseFeatures = (feat: any, fallback: string[]): string[] => {
    let rawList: string[] = [];
    if (Array.isArray(feat)) rawList = feat;
    else if (typeof feat === "string") {
      try {
        rawList = JSON.parse(feat);
      } catch {
        rawList = [feat];
      }
    }
    const filtered = rawList.filter((f) => !excludedFeatures.includes(f.trim()));
    return filtered.length > 0 ? filtered : fallback;
  };

  const subStatus = currentSub?.status || (currentSub?.isactive ? "active" : "inactive");
  const endDateStr = currentSub?.whatsappenddate
    ? new Date(currentSub.whatsappenddate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No Active End Date";

  const isYearlyCurrent =
    currentSub?.whatsappenddate &&
    currentSub?.whatsappstartdate &&
    new Date(currentSub.whatsappenddate).getTime() - new Date(currentSub.whatsappstartdate).getTime() > 100 * 86400000;

  const currentPlanName = isYearlyCurrent ? "Yearly Plan" : currentSub?.planname || "Monthly Plan";

  const handleSubscribe = async (planCode: string, amount: number, planName: string) => {
    if (!schoolKey) return;
    setIsProcessing(true);

    try {
      const response = await fetch("/api/subscription/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100,
          planName: planName,
          type: "whatsapp_subscription",
          planKey: planCode,
          schoolKey: schoolKey,
        }),
      });

      const orderData = await response.json();
      if (!response.ok || !orderData.id) {
        throw new Error(orderData.error || "Failed to create subscription order.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "EdDesk Communication Suite",
        description: `${planName} Subscription`,
        order_id: orderData.id,
        handler: async function (paymentResponse: any) {
          try {
            const verifyRes = await fetch("/api/subscription/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature,
                planKey: planCode,
                amount: amount,
                type: "whatsapp_subscription",
                schoolKey: schoolKey,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              showToast(`Successfully subscribed to ${planName}!`, "success", "Subscription Active");
              // Refresh subscription
              const supabase = createClient();
              const { data: updatedSub } = await supabase
                .from("subscriptions")
                .select("*")
                .eq("schoolkey", schoolKey)
                .maybeSingle();
              if (updatedSub) setCurrentSub(updatedSub);
            } else {
              showToast("Subscription verification failed.", "error");
            }
          } catch (err) {
            console.error("Verification Error:", err);
            showToast("An error occurred verifying subscription.", "error");
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
      showToast(err.message || "Subscription initialization failed.", "error");
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
          eyebrow="Plan"
          title="Subscription"
          description={`Your school is currently on the ${currentPlanName}. View plans and WhatsApp messaging pricing below.`}
        />

        {/* Current Subscription Status Panel */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="surface p-7">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <p className="text-eyebrow">Current active plan</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">{currentPlanName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Valid until {endDateStr}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                  subStatus === "active"
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {subStatus}
              </span>
            </div>

            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Available WhatsApp Credits</span>
                  <span className="font-semibold tabular-nums">
                    {(currentSub?.whatsappcredit ?? 0).toLocaleString()}
                  </span>
                </div>
                <Bar value={Math.min(100, ((currentSub?.whatsappcredit ?? 0) / 5000) * 100)} />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>Plan Renewal Status</span>
                  <span className="font-semibold capitalize text-success">Active</span>
                </div>
                <Bar value={100} />
              </div>
            </div>
          </div>

          <Panel title="Billing & WhatsApp Pricing" hint="Managed via Razorpay Gateway">
            <p className="text-eyebrow">Active Subscription</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">{currentPlanName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Includes unlimited report card formatting</p>
          </Panel>
        </section>

        {/* Available Plans Cards */}
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Choose WhatsApp Subscription Plan</h2>
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
            {/* Monthly Plan Card */}
            <article className="surface flex flex-col justify-between p-7 border-border hover:border-primary/40 transition-colors">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Zap className="size-5" strokeWidth={2} />
                  </div>
                  {!isYearlyCurrent && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Current
                    </span>
                  )}
                </div>

                <h3 className="mt-4 font-display text-xl font-semibold">Monthly Plan</h3>
                <p className="mt-1 text-xs text-muted-foreground">Flexible month-to-month subscription.</p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold tabular-nums">
                    ₹{monthlyFinalPrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                </div>

                <ul className="mt-6 space-y-3 border-t border-border pt-5">
                  {parseFeatures(monthlyPlanObj.features, defaultMonthlyFeatures).map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 shrink-0 text-success" strokeWidth={2.4} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled={!isYearlyCurrent || isProcessing}
                onClick={() => handleSubscribe("monthly", monthlyFinalPrice, "Monthly Plan")}
                className="mt-8 rounded-xl border border-border py-3 text-sm font-semibold transition-colors enabled:hover:border-primary enabled:hover:bg-primary enabled:hover:text-primary-foreground disabled:opacity-50"
              >
                {!isYearlyCurrent ? "Active Plan" : isProcessing ? "Processing..." : "Subscribe Monthly (₹" + monthlyFinalPrice + "/mo)"}
              </button>
            </article>

            {/* Yearly Growth Plan Card */}
            <article className="surface relative flex flex-col justify-between p-7 border-primary/50 shadow-card">
              <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {yearlyResult.badge || "Best Value"}
              </span>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
                    <Crown className="size-5" strokeWidth={2} />
                  </div>
                  {isYearlyCurrent && (
                    <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                      Current
                    </span>
                  )}
                </div>

                <h3 className="mt-4 font-display text-xl font-semibold">Yearly Growth Plan</h3>
                <p className="mt-1 text-xs text-muted-foreground">Best savings for continuous school usage.</p>

                <div className="mt-6 flex items-baseline gap-2">
                  {yearlyResult.showStrikethrough && (
                    <span className="text-sm line-through text-muted-foreground">
                      ₹{yearlyResult.originalPrice.toLocaleString()}
                    </span>
                  )}
                  <span className="font-display text-4xl font-semibold tabular-nums">
                    ₹{yearlyFinalPrice.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">/ year</span>
                </div>

                {yearlyResult.savingsLabel && (
                  <p className="mt-2 text-xs font-semibold text-success">
                    {yearlyResult.savingsLabel}
                  </p>
                )}

                <ul className="mt-6 space-y-3 border-t border-border pt-5">
                  {parseFeatures(yearlyPlanObj.features, defaultYearlyFeatures).map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="size-4 shrink-0 text-success" strokeWidth={2.4} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                disabled={isYearlyCurrent || isProcessing}
                onClick={() => handleSubscribe("yearly", yearlyFinalPrice, "Yearly Growth Plan")}
                className="mt-8 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isYearlyCurrent ? "Active Plan" : isProcessing ? "Processing..." : "Subscribe Yearly (₹" + yearlyFinalPrice.toLocaleString() + "/yr)"}
              </button>
            </article>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
