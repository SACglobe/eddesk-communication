"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { MessageSquare, ShieldCheck, Zap, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    Razorpay: any;
  }
}



export default function WhatsAppTopup() {
  const [schoolKey, setSchoolKey] = useState<string | null>(null);
  const [currentCredit, setCurrentCredit] = useState<number | null>(null);
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
  
  const [customAmount, setCustomAmount] = useState<string>("500");

  useEffect(() => {
    const fetchCredit = async () => {
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

        const { data } = await supabase
          .from('subscriptions')
          .select('whatsappcredit')
          .eq('schoolkey', key)
          .eq('isactive', true)
          .eq('status', 'active')
          .maybeSingle();

        if (data) {
          setCurrentCredit(data.whatsappcredit || 0);
        }
      } catch (err) {
        console.error("Error fetching credit balance:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCredit();
  }, []);

  const handlePayment = async (amountInRupees: number) => {
    if (!isRazorpayLoaded) {
      alert("Payment gateway is loading, please try again in a moment.");
      return;
    }
    if (amountInRupees <= 0) {
        alert("Minimum top-up amount is ₹1");
        return;
    }
    
    setIsProcessing(true);

    try {
      const orderResponse = await fetch("/api/subscription/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInRupees * 100, // Razorpay expects paise
          planName: `${amountInRupees} WhatsApp Credits`,
          planKey: `topup_${amountInRupees}`,
          type: 'whatsapp_topup'
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
        description: `Top-up ${amountInRupees} Credits`,
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
                amount: amountInRupees,
                type: 'whatsapp_topup',
                schoolKey: schoolKey
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.success) {
              window.location.reload(); 
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
          color: "#10B981"
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

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="w-full relative bg-slate-50/95 backdrop-blur-md flex flex-col items-center justify-start p-4 min-h-full overflow-y-auto">
      <Script 
        src="https://checkout.razorpay.com/v1/checkout.js" 
        onLoad={() => setIsRazorpayLoaded(true)}
      />

      <div className="w-full max-w-5xl mx-auto py-8 md:py-12 relative">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 max-w-4xl mx-auto flex flex-col md:flex-row gap-12 items-center md:items-stretch animate-in fade-in zoom-in-95 duration-500 mt-8">
          
          {/* Left Column: Current Balance */}
          <div className="flex-1 w-full flex flex-col items-center justify-center text-center space-y-4 md:border-r border-slate-100 md:pr-12 py-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
              <MessageSquare className="w-10 h-10" />
            </div>
            <div className="space-y-1 mt-4">
                <h3 className="text-slate-500 font-semibold uppercase tracking-wider text-sm mb-3">Available Credits</h3>
                <div className="text-6xl font-black text-slate-900 tracking-tight">
                  {currentCredit?.toLocaleString() || 0}
                </div>
                <p className="text-sm text-slate-400 font-medium pt-2">
                  Messages remaining
                </p>
            </div>
          </div>

          {/* Right Column: Custom Amount */}
          <div className="flex-1 w-full flex flex-col items-center justify-center py-4">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-extrabold text-slate-900">Buy Credits</h3>
              <p className="text-slate-500 text-sm mt-1 font-medium">1 Credit = ₹1</p>
            </div>
            
            <div className="flex flex-col items-center w-full space-y-5">
              <div className="w-full max-w-xs">
                <div className="relative">
                  <input 
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 500"
                    value={customAmount}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d+$/.test(val)) {
                            setCustomAmount(val);
                        }
                    }}
                    className="w-full text-center text-4xl font-black text-slate-900 py-4 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div className="w-full max-w-xs p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Total Cost</span>
                  <span className="text-2xl font-black text-emerald-600">₹{customAmount ? parseInt(customAmount).toLocaleString() : '0'}</span>
              </div>

              <button
                onClick={() => {
                  const amt = parseInt(customAmount);
                  if (amt > 0) handlePayment(amt);
                  else alert("Minimum top-up amount is ₹1");
                }}
                disabled={isProcessing || !customAmount || parseInt(customAmount) <= 0}
                className="w-full max-w-xs py-4 rounded-2xl font-bold text-white text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {isProcessing ? 'Processing...' : `Pay ₹${customAmount ? parseInt(customAmount).toLocaleString() : '0'}`}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
