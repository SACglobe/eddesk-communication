"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useAuthGuard(requireSubscription = true) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [accessError, setAccessError] = useState<'no_access' | 'restricted' | null>(null);
    const [schoolKey, setSchoolKey] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    if (isMounted) {
                        router.push('/login');
                    }
                    return;
                }

                // Query whatsappusers by authuserid
                let { data: whatsappUser, error: fetchError } = await supabase
                    .from("whatsappusers")
                    .select("*")
                    .eq("authuserid", user.id)
                    .maybeSingle();

                // Fallback: If not found by authuserid, attempt server-side provisioning if email matches a registered school
                if (!whatsappUser && user.email) {
                    try {
                        const provRes = await fetch("/api/auth/provision-user", { method: "POST" });
                        const provJson = await provRes.json();
                        if (provJson?.success && provJson?.user) {
                            whatsappUser = provJson.user;
                        }
                    } catch (e) {
                        console.error("Provisioning user failed:", e);
                    }
                }

                if (fetchError) {
                    console.error("whatsappusers query error (check RLS policies):", fetchError);
                }

                // Case 1: No entry in whatsappusers -> user has no access
                if (!whatsappUser) {
                    if (isMounted) {
                        setAccessError('no_access');
                        setIsAuthorized(false);
                    }
                    return;
                }

                // Case 2: Entry exists but isactive is false -> user is restricted
                if (!whatsappUser.isactive) {
                    if (isMounted) {
                        setAccessError('restricted');
                        setIsAuthorized(false);
                    }
                    return;
                }

                // Case 3: Entry exists and isactive is true -> access granted
                const key = whatsappUser.schoolkey;
                const role = whatsappUser.role || 'user';
                const adminFlag = role.toLowerCase() === 'admin' || !!whatsappUser.issuperadmin;

                if (isMounted) {
                    setSchoolKey(key);
                    setUserRole(role);
                    setIsAdmin(adminFlag);
                }

                if (requireSubscription) {
                    if (key) {
                        const now = new Date();
                        const { data: subData } = await supabase
                            .from("subscriptions")
                            .select("*")
                            .eq("schoolkey", key)
                            .eq("isactive", true)
                            .eq("status", "active")
                            .maybeSingle();

                        const expiryDateStr = subData?.whatsappenddate || subData?.enddate;
                        const isExpired = expiryDateStr ? new Date(expiryDateStr) < now : false;

                        if ((!subData || isExpired) && pathname !== '/subscription') {
                            if (isMounted) {
                                router.push('/subscription');
                            }
                            return;
                        }
                    } else if (pathname !== '/subscription') {
                        if (isMounted) {
                            router.push('/subscription');
                        }
                        return;
                    }
                }

                if (isMounted) {
                    setIsAuthorized(true);
                }
            } catch (err) {
                console.error("Auth guard error:", err);
                if (isMounted) {
                    setIsAuthorized(true);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, [router, pathname, requireSubscription]);

    return { isLoading, isAuthorized, accessError, schoolKey, userRole, isAdmin };
}
