"use client";

import { Lock, ShieldAlert, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AccessDeniedProps {
    type: 'no_access' | 'restricted';
}

export default function AccessDenied({ type }: AccessDeniedProps) {
    const isRestricted = type === 'restricted';

    const handleSignOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen w-full bg-slate-50 flex items-center justify-center p-6 font-sans">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
                
                {/* Icon Container */}
                <div className="flex justify-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border ${
                        isRestricted 
                            ? 'bg-rose-50 border-rose-100 text-rose-600' 
                            : 'bg-amber-50 border-amber-100 text-amber-600'
                    }`}>
                        {isRestricted ? <ShieldAlert className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
                    </div>
                </div>

                {/* Text Details */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900">
                        {isRestricted ? "Access Restricted" : "Access Required"}
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        {isRestricted ? (
                            <>Your WhatsApp access has been <span className="font-semibold text-rose-600">restricted</span>. Please contact your school administrator to lift the restriction.</>
                        ) : (
                            <>No WhatsApp access found for your account. Please contact your school administrator to request access.</>
                        )}
                    </p>
                </div>

                {/* Contact Hint Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-500 text-left space-y-1">
                    <p className="font-bold text-slate-700">What should I do?</p>
                    <p>Reach out to your school's administrator or IT desk with your registered email address to enable your access.</p>
                </div>

                {/* Sign Out Action */}
                <button
                    onClick={handleSignOut}
                    className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out & Switch Account</span>
                </button>

            </div>
        </div>
    );
}
