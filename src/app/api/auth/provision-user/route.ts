import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user || !user.email) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const cleanEmail = user.email.trim().toLowerCase();

    // Check if user already exists in whatsappusers
    const { data: existingUser } = await supabase
      .from("whatsappusers")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.authuserid !== user.id) {
        await supabase
          .from("whatsappusers")
          .update({ authuserid: user.id })
          .eq("key", existingUser.key);
      }
      return NextResponse.json({ success: true, user: existingUser });
    }

    // Check if user's email matches a registered school in schools table
    const { data: schoolData } = await supabase
      .from("schools")
      .select("key, name, email")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (!schoolData) {
      return NextResponse.json(
        { success: false, error: "No school found for this email" },
        { status: 404 }
      );
    }

    // Provision new entry in whatsappusers for this school
    const { data: newUser, error: insertError } = await supabase
      .from("whatsappusers")
      .insert({
        authuserid: user.id,
        email: cleanEmail,
        schoolkey: schoolData.key,
        isactive: true,
        role: "admin",
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.error("[Provision User] Insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    console.error("[Provision User] Unhandled exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Provisioning failed" },
      { status: 500 }
    );
  }
}
