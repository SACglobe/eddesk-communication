"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WhatsAppSubscription from "@/components/WhatsAppSubscription";
import AccessDenied from "@/components/AccessDenied";
import { createClient } from "@/lib/supabase/client";

export default function SubscriptionPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [accessError, setAccessError] = useState<'no_access' | 'restricted' | null>(null);

    useEffect(() => {
        const checkUserAndSubscription = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }

                const { data: whatsappUser } = await supabase
                    .from("whatsappusers")
                    .select("schoolkey, isactive")
                    .eq("authuserid", user.id)
                    .maybeSingle();

                if (!whatsappUser) {
                    setAccessError('no_access');
                    setIsLoading(false);
                    return;
                }

                if (!whatsappUser.isactive) {
                    setAccessError('restricted');
                    setIsLoading(false);
                    return;
                }

                if (whatsappUser.schoolkey) {
                    const now = new Date().toISOString();
                    const { data: subData } = await supabase
                        .from("subscriptions")
                        .select("*")
                        .eq("schoolkey", whatsappUser.schoolkey)
                        .eq("isactive", true)
                        .eq("status", "active")
                        .gte("whatsappenddate", now)
                        .limit(1)
                        .maybeSingle();

                    // If user WhatsApp subscription is NOT expired, redirect to home /
                    if (subData) {
                        router.push('/');
                        return;
                    }
                }

                setIsLoading(false);
            } catch (err) {
                console.error("Subscription check error:", err);
                setIsLoading(false);
            }
        };

        checkUserAndSubscription();
    }, [router]);

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (accessError) {
        return <AccessDenied type={accessError} />;
    }

    if (isLoading) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F54927]"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 w-full flex flex-col">
            {/* Top Sign-out bar (no sidebar) */}
            <div className="w-full flex justify-end p-4 md:p-6 bg-white border-b border-gray-100">
                <button 
                    onClick={handleSignOut}
                    className="text-gray-500 hover:text-gray-700 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                </button>
            </div>
            
            {/* Main Content Area showing WhatsApp plans only */}
            <div className="flex-1 w-full overflow-y-auto">
                <WhatsAppSubscription showOnlyPlans={true} />
            </div>
        </div>
    );
}
