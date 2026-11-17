import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@/lib/supabase/server";

// Sends the "parent app" WhatsApp invite (Twilio content template parent_app_invite_v2: body {{1}} = school name,
// button https://app.eddesk.in/parents/{{2}} = the school's slug). The school, its name and its slug are read from the database
// for the signed-in user, never from the request, so one school cannot send under another's name.
const CONTENT_SID = process.env.TWILIO_APP_INVITE_CONTENT_SID || "HXe71f211dc4eb6e87120629493ce01226";
const CREDITS_PER_INVITE = 1;
const MAX_PER_REQUEST = 25;
const PARALLEL = 5;

type Recipient = { mobile: string; studentName?: string; classSec?: string };

function inviteBody(schoolName: string) {
  return [
    `🎓 *${schoolName}* 🎓`,
    "",
    "Dear Parent,",
    "",
    "We now have our own parent app. Stay connected with your child's school:",
    "",
    "📚 Homework and assignments",
    "📢 Notices and announcements",
    "📝 Requests and leave",
    "🏆 Rank cards and results",
    "",
    "👇 Tap *Download app* below to get started.",
    "",
    "Thank you!",
  ].join("\n");
}

const fail = (status: number, code: string, error: string) =>
  NextResponse.json({ success: false, code, error }, { status });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "UNAUTHENTICATED", "Please sign in again.");

    let body: { recipients?: Recipient[] };
    try {
      body = await req.json();
    } catch {
      return fail(400, "BAD_REQUEST", "Invalid request.");
    }

    // Recipients: valid 10-digit numbers, each number once.
    const seen = new Set<string>();
    const recipients: Recipient[] = [];
    for (const r of Array.isArray(body.recipients) ? body.recipients : []) {
      const mobile = String(r?.mobile ?? "").replace(/\D/g, "").slice(-10);
      if (!/^[6-9]\d{9}$/.test(mobile) || seen.has(mobile)) continue;
      seen.add(mobile);
      recipients.push({
        mobile,
        studentName: typeof r.studentName === "string" ? r.studentName.slice(0, 120) : "",
        classSec: typeof r.classSec === "string" ? r.classSec.slice(0, 60) : "",
      });
    }
    if (recipients.length === 0) return fail(400, "NO_RECIPIENTS", "Select at least one valid 10-digit mobile number.");
    if (recipients.length > MAX_PER_REQUEST) return fail(400, "TOO_MANY", `Send at most ${MAX_PER_REQUEST} numbers per request.`);

    // The school of the signed-in user
    let { data: wu } = await supabase.from("whatsappusers").select("schoolkey").eq("authuserid", user.id).maybeSingle();
    if (!wu && user.email) {
      const r = await supabase.from("whatsappusers").select("schoolkey").ilike("email", user.email.trim().toLowerCase()).maybeSingle();
      wu = r.data;
    }
    const schoolKey: string | undefined = wu?.schoolkey;
    if (!schoolKey) return fail(403, "NO_SCHOOL", "This account is not linked to a school.");

    const { data: school } = await supabase
      .from("schools")
      .select("name, slug, androidurl, iosurl")
      .eq("key", schoolKey)
      .maybeSingle();
    if (!school?.name || !school.slug || !(school.androidurl || school.iosurl)) {
      return fail(409, "APP_LINK_MISSING", "Your school's app download link is not set up yet. Contact EdDesk support.");
    }

    const { data: sub } = await supabase.from("subscriptions").select("whatsappcredit").eq("schoolkey", schoolKey).maybeSingle();
    const credits = sub?.whatsappcredit ?? 0;
    const needed = recipients.length * CREDITS_PER_INVITE;
    if (credits < needed) {
      return fail(402, "INSUFFICIENT_CREDITS", `You need ${needed} credits for ${recipients.length} invites but have ${credits}.`);
    }

    // The history table must exist before anything is sent, so every message is recorded.
    const probe = await supabase.from("app_invite_history").select("id", { head: true, count: "exact" }).eq("schoolkey", schoolKey);
    if (probe.error) {
      console.error("app_invite_history not available:", probe.error);
      return fail(500, "HISTORY_UNAVAILABLE", "Invite history is not set up yet. Contact EdDesk support.");
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
    if (!accountSid || !authToken || !fromNumber) {
      return fail(500, "NOT_CONFIGURED", "WhatsApp service is not configured. Contact the administrator.");
    }
    const client = twilio(accountSid, authToken);

    let statusCallback = process.env.TWILIO_STATUS_CALLBACK;
    if (!statusCallback && process.env.NEXT_PUBLIC_APP_URL) statusCallback = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio-status`;

    const message = inviteBody(school.name);
    const results: { mobile: string; ok: boolean; sid?: string; error?: string }[] = [];

    const sendOne = async (r: Recipient) => {
      let sid: string | null = null;
      let status = "failed";
      let errorMessage: string | null = null;
      let errorCode: string | null = null;
      try {
        const msg = await client.messages.create({
          from: fromNumber,
          to: `whatsapp:+91${r.mobile}`,
          contentSid: CONTENT_SID,
          contentVariables: JSON.stringify({ 1: school.name, 2: school.slug }),
          ...(statusCallback ? { statusCallback } : {}),
        });
        sid = msg.sid;
        status = msg.status || "queued";
        results.push({ mobile: r.mobile, ok: true, sid: msg.sid });
      } catch (err: unknown) {
        errorMessage = err instanceof Error ? err.message : "Failed to send.";
        const code = (err as { code?: number | string })?.code;
        errorCode = code !== undefined ? String(code) : null;
        results.push({ mobile: r.mobile, ok: false, error: errorMessage });
      }
      const { error: insertError } = await supabase.from("app_invite_history").insert({
        schoolkey: schoolKey,
        user_id: user.id,
        sender_email: user.email ?? null,
        studentname: r.studentName || null,
        mobile: r.mobile,
        classsec: r.classSec || null,
        message,
        sid,
        status,
        error_code: errorCode,
        error_message: errorMessage,
      });
      if (insertError) console.error("app_invite_history insert failed:", insertError);
    };

    for (let i = 0; i < recipients.length; i += PARALLEL) {
      await Promise.all(recipients.slice(i, i + PARALLEL).map(sendOne));
    }

    // A failed send costs nothing. Re-read the balance so credits spent elsewhere in the meantime are kept.
    const sent = results.filter((r) => r.ok).length;
    let creditsLeft = credits;
    if (sent > 0) {
      const { data: latest } = await supabase.from("subscriptions").select("whatsappcredit").eq("schoolkey", schoolKey).maybeSingle();
      creditsLeft = Math.max(0, (latest?.whatsappcredit ?? credits) - sent * CREDITS_PER_INVITE);
      await supabase.from("subscriptions").update({ whatsappcredit: creditsLeft }).eq("schoolkey", schoolKey);
    }

    return NextResponse.json({ success: true, sent, failed: results.length - sent, creditsLeft, results });
  } catch (err) {
    console.error("send-app-invite error:", err);
    return fail(500, "SERVER_ERROR", "Could not send the invites. Please try again.");
  }
}
