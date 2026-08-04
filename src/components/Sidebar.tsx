"use client";

import { useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, CreditCard, Wallet, Crown, GraduationCap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthGuard } from "@/lib/useAuthGuard";

interface SidebarProps {
    selectedScreenKey?: string | null;
    onSelectScreen?: (key: string) => void;
}

export const MAIN_ITEMS = [
    {
        key: 'whatsapp-sender',
        href: '/',
        label: 'WhatsApp Sender',
        icon: <MessageSquare className="w-[18px] h-[18px]" />
    },
    {
        key: 'history',
        href: '/history',
        label: 'History',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    }
];

export const ACADEMIC_ITEMS = [
    {
        key: 'manage-classes',
        href: '/manage-classes',
        label: 'Manage Classes',
        icon: <GraduationCap className="w-[18px] h-[18px]" />
    }
];

export const SUBSCRIPTION_ITEMS = [
    {
        key: 'whatsapp-subscription',
        href: '/plans',
        label: 'Plan Details',
        icon: <Crown className="w-[18px] h-[18px]" />
    },
    {
        key: 'whatsapp-topup',
        href: '/topup',
        label: 'Credit Top-up',
        icon: <Wallet className="w-[18px] h-[18px]" />
    }
];

export const BOTTOM_ITEMS = [
    {
        key: 'logout',
        href: '/login',
        label: 'Logout',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
    }
];

export default function Sidebar({
    selectedScreenKey,
    onSelectScreen,
}: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAdmin } = useAuthGuard(false);

    type PanelControlState = 'expanded' | 'expand_on_hover' | 'collapsed';
    const [panelState, setPanelState] = useState<PanelControlState>('expand_on_hover');
    const [showPanelOptions, setShowPanelOptions] = useState(false);
    
    // Refs
    const railRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const getActiveKey = () => {
        if (selectedScreenKey) return selectedScreenKey;
        if (pathname === '/history') return 'history';
        if (pathname === '/manage-classes') return 'manage-classes';
        if (pathname === '/plans' || pathname === '/subscription') return 'whatsapp-subscription';
        if (pathname === '/topup') return 'whatsapp-topup';
        return 'whatsapp-sender';
    };

    const activeKey = getActiveKey();

    const handleItemClick = async (item: typeof MAIN_ITEMS[0]) => {
        if (onSelectScreen) {
            onSelectScreen(item.key);
        }
        if (item.key === 'logout') {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push('/login');
        } else {
            router.push(item.href);
        }
    };

    const widthClass = panelState === 'expanded'
        ? 'w-64'
        : panelState === 'collapsed'
            ? 'w-[72px]'
            : 'w-[72px] group-hover/rail:w-64';

    const shadowClass = panelState === 'expanded'
        ? 'border-r border-[#f1f1f1] bg-white'
        : panelState === 'collapsed'
            ? 'shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-[#f1f1f1]'
            : 'shadow-[4px_0_24px_rgba(0,0,0,0.02)] group-hover/rail:shadow-[8px_0_32px_rgba(245,73,39,0.08)] border-r border-[#f1f1f1]';

    const textOpacityClass = panelState === 'expanded'
        ? 'opacity-100'
        : panelState === 'collapsed'
            ? 'opacity-0'
            : 'opacity-0 group-hover/rail:opacity-100';

    const outerWidthClass = panelState === 'expanded' ? 'w-64' : 'w-[72px]';
    const isCollapsedMode = panelState === 'collapsed' || panelState === 'expand_on_hover';

    const renderNavItems = (items: typeof MAIN_ITEMS) => (
        <nav className="px-3.5 space-y-1">
            {items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                    <button
                        key={item.key}
                        onClick={() => handleItemClick(item)}
                        className={`w-full flex items-center rounded-xl text-[13px] font-semibold transition-all duration-300 relative group/item ${isActive
                            ? 'text-[#F54927] bg-[#F54927]/5'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50/80'
                            } px-3.5 py-2.5 h-12`}
                    >
                        {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#F54927] rounded-r-full shadow-[0_0_12px_rgba(245,73,39,0.4)]" />
                        )}
                        <span className={`transition-all duration-300 flex-shrink-0 transform group-hover/item:scale-110 ${isActive ? "text-[#F54927]" : "text-gray-400"}`}>
                            {item.icon}
                        </span>
                        <span className={`ml-4 truncate ${textOpacityClass} transition-all duration-500 tracking-tight font-bold w-full text-left`}>
                            {item.label}
                        </span>
                        {isCollapsedMode && (
                            <div className={`absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-[11px] font-bold rounded-lg opacity-0 pointer-events-none whitespace-nowrap z-[100] shadow-xl border border-gray-800 transition-all duration-200 translate-x-1 group-hover/item:translate-x-0 group-hover/item:opacity-100 ${panelState === 'expand_on_hover' ? 'group-hover/rail:hidden' : ''}`}>
                                {item.label}
                                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 border-l border-b border-gray-800" />
                            </div>
                        )}
                    </button>
                );
            })}
        </nav>
    );

    return (
        <div className={`relative h-full flex-shrink-0 z-50 group/rail font-sans transition-all duration-500 ${outerWidthClass}`}>
            <div
                ref={railRef}
                className={`absolute top-0 left-0 h-full backdrop-blur-xl transition-all duration-500 flex flex-col overflow-visible ${widthClass} ${shadowClass} z-50`}
            >
                {/* ── Navigation Content (Scrollable Area) ── */}
                <div
                    className={`pt-4 custom-scrollbar overflow-y-auto overflow-x-hidden flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
                >
                    <div className={`px-5 pb-2 ${textOpacityClass} transition-opacity duration-300`}>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            Main
                        </h3>
                    </div>
                    {renderNavItems(MAIN_ITEMS)}

                    {isAdmin && (
                        <>
                            <div className="mx-3.5 my-3 border-t border-gray-100" />
                            <div className={`px-5 pb-2 ${textOpacityClass} transition-opacity duration-300`}>
                                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                    Academic
                                </h3>
                            </div>
                            {renderNavItems(ACADEMIC_ITEMS)}
                        </>
                    )}

                    <div className="mx-3.5 my-3 border-t border-gray-100" />
                    
                    <div className={`px-5 pb-2 ${textOpacityClass} transition-opacity duration-300`}>
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            Subscription
                        </h3>
                    </div>
                    {renderNavItems(SUBSCRIPTION_ITEMS)}
                </div>

                {/* ── Bottom Section (Logout & Sidebar Control) ── */}
                <div
                    className="border-t border-gray-100 flex-shrink-0 relative"
                    style={{ height: 'auto' }}
                    ref={menuRef}
                >
                    <div className="pt-2">
                        {renderNavItems(BOTTOM_ITEMS)}
                    </div>
                    <div className="px-3.5 h-14 flex items-center">
                        <button
                            onClick={() => setShowPanelOptions(!showPanelOptions)}
                            className="w-full flex items-center rounded-md text-[13px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 px-3.5 py-2.5 transition-colors group/ctrl"
                        >
                            <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect strokeWidth={1.5} x={3} y={3} width={18} height={18} rx={2} />
                                <path strokeWidth={1.5} d="M9 3v18" />
                            </svg>
                            <span className={`ml-4 truncate w-full text-left ${textOpacityClass} transition-opacity duration-500 tracking-tight`}>
                                Sidebar control
                            </span>
                        </button>
                    </div>

                    {showPanelOptions && (
                        <div className={`absolute bottom-full mb-1 w-48 bg-white rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200 z-[100] ${panelState === 'collapsed' ? 'left-14' : 'left-4'}`}>
                            <div className="px-3 py-2 text-[11px] font-semibold text-gray-500 border-b border-gray-100">Sidebar control</div>
                            <div className="py-1">
                                {(['expanded', 'collapsed', 'expand_on_hover'] as PanelControlState[]).map(opt => (
                                    <button
                                        key={opt}
                                        onClick={() => { setPanelState(opt); setShowPanelOptions(false); }}
                                        className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 transition-colors flex items-center gap-2.5 ${panelState === opt ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                                    >
                                        <div className="w-3 flex items-center justify-center">
                                            {panelState === opt && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />
                                            )}
                                        </div>
                                        {opt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
