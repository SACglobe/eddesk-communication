"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { Calendar, Zap, CheckCircle2, Crown, ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { calculatePlanPrice } from "@/lib/utils/pricing";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface WhatsAppSubscriptionProps {
  showOnlyPlans?: boolean;
}

export default function WhatsAppSubscription({ showOnlyPlans = false }: WhatsAppSubscriptionProps) {
  const [schoolKey, setSchoolKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRazorpayLoaded, setIsRazorpayLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setIsRazorpayLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay SDK");
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data: whatsappUser } = await supabase
            .from("whatsappusers")
            .select("schoolkey, isactive")
            .eq("authuserid", user.id)
            .maybeSingle();

        if (!whatsappUser || !whatsappUser.schoolkey || !whatsappUser.isactive) {
          setIsLoading(false);
          return;
        }
        
        const key = whatsappUser.schoolkey;
        setSchoolKey(key);

        // Fetch plans
        const { data: plansData } = await supabase
          .from('plans')
          .select('*')
          .order('idx', { ascending: true });

        // Fetch current subscription
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('schoolkey', key)
          .maybeSingle();

        if (plansData) {
          setPlans(plansData);
        }
        
        if (subData) {
          setCurrentSubscription(subData);
        }
      } catch (err) {
        console.error("Error fetching subscription data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F54927]"></div>
      </div>
    );
  }

  const now = new Date();
  const endDate = currentSubscription?.whatsappenddate ? new Date(currentSubscription.whatsappenddate) : null;
  const startDate = currentSubscription?.whatsappstartdate ? new Date(currentSubscription.whatsappstartdate) : null;
  const isExpired = endDate ? endDate < now : true;
  const hasActiveSubscription = currentSubscription?.isactive && !isExpired;

  // Calculate days remaining
  const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

  // Format dates
  const formatDate = (d: Date | null) => {
    if (!d) return "N/A";
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  // Extended date math for Yearly Plan
  const calculateExtendedDate = () => {
    const base = (endDate && endDate > now) ? new Date(endDate) : new Date();
    const extended = new Date(base);
    extended.setFullYear(extended.getFullYear() + 1);
    return formatDate(extended);
  };

  // Identify plan type & dynamic prices from Supabase plans table with discounts applied
  const yearlyPlanObj = plans.find(p => p.code === 'yearly' || p.idx === 0);
  const monthlyPlanObj = plans.find(p => p.code === 'monthly' || p.idx === 1);

  const monthlyPriceResult = monthlyPlanObj ? calculatePlanPrice(monthlyPlanObj) : null;
  const monthlyFinalPrice = monthlyPriceResult ? monthlyPriceResult.finalPrice : (monthlyPlanObj?.whatsappprice ? Number(monthlyPlanObj.whatsappprice) : 100);

  const yearlyPriceResult = yearlyPlanObj ? calculatePlanPrice(yearlyPlanObj, monthlyFinalPrice) : null;
  const yearlyFinalPrice = yearlyPriceResult ? yearlyPriceResult.finalPrice : (yearlyPlanObj?.whatsappprice ? Number(yearlyPlanObj.whatsappprice) : 1200);
  const yearlyOriginalPrice = yearlyPriceResult ? yearlyPriceResult.originalPrice : yearlyFinalPrice;
  const showYearlyStrikethrough = yearlyPriceResult ? yearlyPriceResult.showStrikethrough : (yearlyOriginalPrice > yearlyFinalPrice);
  const yearlyOfferBadge = yearlyPriceResult?.badge || yearlyPriceResult?.planOffer;
  const yearlySavingsLabel = yearlyPriceResult?.savingsLabel;

  const isYearlyCurrent = currentSubscription?.whatsappenddate && startDate && 
    (new Date(currentSubscription.whatsappenddate).getTime() - new Date(currentSubscription.whatsappstartdate).getTime()) > 100 * 24 * 60 * 60 * 1000;
  
  const currentPlanName = isYearlyCurrent ? "YEARLY PLAN" : "MONTHLY PLAN";

  // Payment handler
  const handleSubscribe = async (planKey: string, amount: number, planName: string) => {
    if (!isRazorpayLoaded) {
      alert("Payment gateway is loading, please try again in a moment.");
      return;
    }
    
    setIsProcessing(true);

    try {
      const orderResponse = await fetch("/api/subscription/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount * 100, // paise
          planName: planName,
          planKey: planKey,
          type: 'whatsapp_subscription'
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "EdDesk-Communication Platform",
        description: `${planName} Subscription`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const verifyResponse = await fetch("/api/subscription/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planKey: planKey,
                amount: amount,
                type: 'whatsapp_subscription',
                schoolKey: schoolKey
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.success) {
              window.location.href = "/"; 
            } else {
              alert("Payment verification failed. Please contact support.");
              setIsProcessing(false);
            }
          } catch (err) {
            console.error("Verification Error:", err);
            alert("An error occurred during verification.");
          } finally {
            setIsProcessing(false);
          }
        },
        theme: {
          color: "#0F172A"
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        alert("Payment Failed: " + response.error.description);
        setIsProcessing(false);
      });
      rzp.open();
    } catch (error: any) {
      console.error("Payment Error:", error);
      alert(error.message || "Failed to initialize payment");
      setIsProcessing(false);
    }
  };

  // If showOnlyPlans or no active subscription, render WhatsApp Subscription Plans selection only!
  if (showOnlyPlans || !hasActiveSubscription) {
    return (
      <div className="w-full min-h-full bg-slate-50/50 p-6 md:p-12 font-sans">
        <Script 
          src="https://checkout.razorpay.com/v1/checkout.js" 
          onLoad={() => setIsRazorpayLoaded(true)}
        />

        <div className="max-w-5xl mx-auto space-y-8 py-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">
              Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F54927] to-orange-500">WhatsApp Plan</span>
            </h1>
            <p className="text-slate-500 text-base max-w-xl mx-auto">
              Select a subscription plan to unlock full access to EdDesk-Communication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-4">
            
            {/* Monthly Plan Card */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-xl transition-all">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Monthly Plan</h3>
                <p className="text-slate-500 text-sm mt-1">Flexible month-to-month subscription.</p>

                <div className="my-6">
                  {monthlyPriceResult?.showStrikethrough && (
                    <span className="text-slate-400 line-through text-lg font-semibold mr-2">₹{monthlyPriceResult.originalPrice.toLocaleString()}</span>
                  )}
                  <span className="text-4xl font-black text-slate-900">₹{monthlyFinalPrice.toLocaleString()}</span>
                  <span className="text-slate-500 text-sm"> / month</span>
                </div>

                <ul className="space-y-3 border-t border-slate-100 pt-6">
                  <li className="flex items-center gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Unlimited Report Card Generation</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Instant Delivery Reports</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Top-up credits anytime</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe('monthly', monthlyFinalPrice, 'Monthly Plan')}
                disabled={isProcessing}
                className="w-full mt-8 py-4 px-6 rounded-2xl font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all text-base disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Subscribe Monthly"}
              </button>
            </div>

            {/* Yearly Plan Card */}
            <div className="bg-white rounded-3xl p-8 border-2 border-purple-500 shadow-xl shadow-purple-500/10 flex flex-col justify-between relative hover:shadow-2xl transition-all">
              <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
                  BEST VALUE
                </span>
              </div>

              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6">
                  <Crown className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Yearly Growth Plan</h3>
                <p className="text-slate-500 text-sm mt-1">Best savings for continuous usage.</p>

                <div className="my-6">
                  {showYearlyStrikethrough && (
                    <span className="text-slate-400 line-through text-lg font-semibold mr-2">₹{yearlyOriginalPrice.toLocaleString()}</span>
                  )}
                  <span className="text-4xl font-black text-slate-900">₹{yearlyFinalPrice.toLocaleString()}</span>
                  <span className="text-slate-500 text-sm"> / year</span>
                </div>

                <ul className="space-y-3 border-t border-slate-100 pt-6">
                  <li className="flex items-center gap-3 text-slate-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Save up to 30% annually</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Priority 24/7 Support</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Unlimited Report Card Generation</span>
                  </li>
                  <li className="flex items-center gap-3 text-slate-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>Top-up credits anytime</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe('yearly', yearlyFinalPrice, 'Yearly Growth Plan')}
                disabled={isProcessing}
                className="w-full mt-8 py-4 px-6 rounded-2xl font-extrabold text-white text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Subscribe Yearly"}
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-slate-50/50 p-6 md:p-10 font-sans">
      <Script 
        src="https://checkout.razorpay.com/v1/checkout.js" 
        onLoad={() => setIsRazorpayLoaded(true)}
      />

      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
          <span>General</span>
          <span>/</span>
          <span className="text-slate-900 font-semibold">Plan Details</span>
        </div>

        {/* ── CARD 1: Subscription Overview ── */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm relative overflow-hidden">
          
          {/* Header Row */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#F54927]">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Subscription Overview</h2>
                <p className="text-sm text-slate-400">Billing & Next Payment Details</p>
              </div>
            </div>

            {hasActiveSubscription ? (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 tracking-wider uppercase">
                ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 tracking-wider uppercase">
                NO ACTIVE PLAN
              </span>
            )}
          </div>

          {/* Grid Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Box 1: Plan Identifier */}
            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-6 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">PLAN IDENTIFIER</span>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {hasActiveSubscription ? currentPlanName : "NO PLAN SELECTED"}
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-2">
                  Started on: <span className="text-slate-700 font-semibold">{formatDate(startDate)}</span>
                </p>
              </div>
            </div>

            {/* Box 2: Next Payment Due */}
            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-6 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">NEXT PAYMENT DUE</span>
              <div className="mt-3 flex items-baseline justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {formatDate(endDate)}
                  </h3>
                  {hasActiveSubscription && (
                    <div className="mt-2 inline-flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">Days Remaining:</span>
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold ${daysRemaining <= 10 ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {daysRemaining} DAYS
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── CARD 2: Upgrade / Extend to Yearly Growth ── */}
        <div className="bg-white rounded-3xl p-8 border-2 border-purple-100 shadow-xl shadow-purple-500/5 relative overflow-hidden">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 text-purple-600">
                <Zap className="w-5 h-5 fill-current" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-900">
                  {isYearlyCurrent ? "Extend Yearly Plan" : "Upgrade to Yearly Growth"}
                </h3>
                <p className="text-slate-500 text-sm mt-2 leading-relaxed max-w-lg">
                  Switch to the yearly plan now and secure your platform for the next 12 months. Your new subscription will be extended from your current end date.
                </p>
              </div>

              {/* Bullets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Save up to 30% annually</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Priority support & updates</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Seamless extension of service</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>Single annual invoice</span>
                </div>
              </div>

            </div>

            {/* Right Pricing & Checkout Column */}
            <div className="lg:col-span-5 bg-slate-50/90 border border-slate-200/80 rounded-3xl p-6 text-center flex flex-col items-center justify-center space-y-5">
              
              <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">YEARLY PREMIUM</span>

              {yearlyOfferBadge && (
                <div className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  <Zap className="w-3 h-3 fill-current" />
                  {yearlyOfferBadge}
                </div>
              )}

              <div className="space-y-1">
                {showYearlyStrikethrough && (
                  <span className="text-slate-400 line-through text-lg font-semibold mr-2">₹{yearlyOriginalPrice.toLocaleString()}</span>
                )}
                <span className="text-4xl font-black text-slate-900">₹{yearlyFinalPrice.toLocaleString()}</span>
                <p className="text-xs text-slate-400 font-medium">/ year (Inc. taxes)</p>
              </div>

              {yearlySavingsLabel && (
                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg inline-block">
                  {yearlySavingsLabel}
                </div>
              )}

              <button
                onClick={() => handleSubscribe('yearly', yearlyFinalPrice, 'Yearly Growth Plan')}
                disabled={isProcessing}
                className="w-full py-4 px-6 rounded-2xl font-extrabold text-white text-base bg-slate-900 hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isProcessing ? "Processing..." : "Secure Yearly Plan"}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <p className="text-[11px] text-slate-400 font-medium">
                Pay now to extend your subscription through <span className="text-slate-700 font-semibold">{calculateExtendedDate()}</span>
              </p>

            </div>

          </div>

        </div>

        {/* ── CARD 3: Monthly Option (If no active subscription) ── */}
        {!hasActiveSubscription && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="text-lg font-bold text-slate-900">Prefer Monthly Billing?</h4>
              <p className="text-sm text-slate-500">Subscribe month-to-month for ₹{monthlyFinalPrice.toLocaleString()}/month.</p>
            </div>
            <button
              onClick={() => handleSubscribe('monthly', monthlyFinalPrice, 'Monthly Plan')}
              disabled={isProcessing}
              className="py-3 px-6 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all text-sm whitespace-nowrap"
            >
              Subscribe Monthly (₹{monthlyFinalPrice.toLocaleString()}/mo)
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
