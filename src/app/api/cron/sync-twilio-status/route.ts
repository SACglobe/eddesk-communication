import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createClient } from "@/lib/supabase/server";
import { createClient as createDirectClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const now = new Date();
  const url = new URL(req.url);
  const isManual = req.method === "POST" || url.searchParams.get("manual") === "true";

  // 1. Time restriction: Skip automatic background cron execution between 10 PM (22:00) and 8 AM (08:00) IST.
  // Manual button clicks from user on History page bypass this check.
  if (!isManual) {
    const istHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(now);
    const istHour = parseInt(istHourStr, 10);

    if (istHour >= 22 || istHour < 8) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: `Cron job suspended between 10 PM and 8 AM IST (current IST hour: ${istHour}:00).`,
        timestamp: now.toISOString(),
      });
    }
  }

  try {
    let supabase: any;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
      supabase = createDirectClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
    } else {
      try {
        supabase = await createClient();
      } catch {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        supabase = createDirectClient(supabaseUrl, supabaseKey);
      }
    }

    // 2. Fetch history records with a Twilio SID
    const customFrom = url.searchParams.get("from");
    const customTo = url.searchParams.get("to");

    let historyQuery = supabase
      .from("report_card_history")
      .select("*")
      .not("sid", "is", null)
      .order("created_at", { ascending: false });

    if (customFrom && customTo) {
      historyQuery = historyQuery
        .gte("created_at", new Date(customFrom).toISOString())
        .lte("created_at", new Date(customTo).toISOString());
    } else {
      historyQuery = historyQuery.limit(50);
    }

    const { data: records, error: dbError } = await historyQuery;

    if (dbError) {
      console.error("[Cron Twilio Sync] Supabase query error:", dbError);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    if (!records || records.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No report card messages found to sync.",
        processedCount: 0,
        timestamp: now.toISOString(),
      });
    }

    // 3. Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error("[Cron Twilio Sync] Twilio credentials missing.");
      return NextResponse.json(
        { success: false, error: "Twilio credentials not configured on server." },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);
    let updatedCount = 0;
    let refundedCount = 0;
    const results: any[] = [];

    // 4. Fetch status from Twilio API for each message
    for (const record of records) {
      try {
        const previousStatus = record.status || "queued";

        // Query Twilio API for current status
        const twilioMsg = await client.messages(record.sid).fetch();

        const freshStatus = twilioMsg.status;
        const freshErrorCode = twilioMsg.errorCode
          ? twilioMsg.errorCode.toString()
          : null;
        const freshErrorMessage = twilioMsg.errorMessage || null;

        const statusChanged = previousStatus !== freshStatus;

        if (statusChanged || freshErrorCode !== record.error_code) {
          // Update DB record
          const { data: updatedRows, error: updateErr } = await supabase
            .from("report_card_history")
            .update({
              status: freshStatus,
              error_code: freshErrorCode,
              error_message: freshErrorMessage,
            })
            .eq("id", record.id)
            .select();

          if (!updateErr) {
            updatedCount++;
          } else {
            console.error(`[Cron Twilio Sync] Update error for ID ${record.id}:`, updateErr);
          }

          // Check if credit refund is needed for failed/undelivered status
          const isFailure = freshStatus === "failed" || freshStatus === "undelivered";
          const wasFailure = previousStatus === "failed" || previousStatus === "undelivered";

          if (isFailure && !wasFailure && record.schoolkey) {
            const { data: sub } = await supabase
              .from("subscriptions")
              .select("whatsappcredit")
              .eq("schoolkey", record.schoolkey)
              .maybeSingle();

            if (sub) {
              const refundedBalance = (sub.whatsappcredit || 0) + 1;
              await supabase
                .from("subscriptions")
                .update({ whatsappcredit: refundedBalance })
                .eq("schoolkey", record.schoolkey);

              refundedCount++;
              console.log(
                `[Cron Twilio Sync] Refunded 1 WhatsApp credit to school: ${record.schoolkey} for msg ${record.sid}`
              );
            }
          }

          results.push({
            id: record.id,
            sid: record.sid,
            previousStatus,
            newStatus: freshStatus,
            errorCode: freshErrorCode,
            errorMessage: freshErrorMessage,
          });
        }
      } catch (twilioErr: any) {
        console.error(
          `[Cron Twilio Sync] Error syncing message ${record.sid}:`,
          twilioErr.message
        );
      }
    }

    return NextResponse.json({
      success: true,
      totalChecked: records.length,
      updatedCount,
      refundedCount,
      updates: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Cron Twilio Sync] Unhandled exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error during sync" },
      { status: 500 }
    );
  }
}
