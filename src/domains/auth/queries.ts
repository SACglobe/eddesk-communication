import { createClient } from "@/lib/supabase/client";

export async function signInWithEmail(email: string, password: string) {
    try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { data, error };
    } catch (err: any) {
        return {
            data: null,
            error: {
                message: err?.message || "Failed to fetch"
            }
        };
    }
}

export async function signOut() {
    try {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        return { error };
    } catch (err: any) {
        return { error: err };
    }
}

export async function getSession() {
    try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();
        return { session: data?.session || null, error };
    } catch (err: any) {
        return { session: null, error: err };
    }
}
