import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        
        const messageSid = formData.get("MessageSid")?.toString() || formData.get("SmsSid")?.toString();
        const messageStatus = formData.get("MessageStatus")?.toString();
        const errorCode = formData.get("ErrorCode")?.toString();
        const errorMessage = formData.get("ErrorMessage")?.toString();

        console.log(`[Twilio Webhook] MessageSid: ${messageSid}, Status: ${messageStatus}, ErrorCode: ${errorCode || "N/A"}`);

        if (!messageSid || !messageStatus) {
            return NextResponse.json({ success: false, error: "Missing MessageSid or MessageStatus" }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch existing history record
        const { data: historyRow, error: fetchErr } = await supabase
            .from("report_card_history")
            .select("id, schoolkey, status")
            .eq("sid", messageSid)
            .maybeSingle();

        if (fetchErr) {
            console.error("[Twilio Webhook] Supabase fetch error:", fetchErr);
        }

        if (historyRow) {
            const previousStatus = historyRow.status;

            // Update delivery status, error code, and error message
            const { error: updateErr } = await supabase
                .from("report_card_history")
                .update({
                    status: messageStatus,
                    error_code: errorCode || null,
                    error_message: errorMessage || null
                })
                .eq("id", historyRow.id);

            if (updateErr) {
                console.error("[Twilio Webhook] Supabase update error:", updateErr);
            }

            // Refund credit if delivery failed or was undelivered (and wasn't previously refunded)
            const isFailure = messageStatus === "failed" || messageStatus === "undelivered";
            const wasFailure = previousStatus === "failed" || previousStatus === "undelivered";

            if (isFailure && !wasFailure && historyRow.schoolkey) {
                const { data: sub } = await supabase
                    .from("subscriptions")
                    .select("whatsappcredit")
                    .eq("schoolkey", historyRow.schoolkey)
                    .maybeSingle();

                if (sub) {
                    const refundedBalance = (sub.whatsappcredit || 0) + 1;
                    await supabase
                        .from("subscriptions")
                        .update({ whatsappcredit: refundedBalance })
                        .eq("schoolkey", historyRow.schoolkey);

                    console.log(`[Twilio Webhook] Refunded 1 WhatsApp credit to school: ${historyRow.schoolkey}`);
                }
            }
        } else {
            console.log(`[Twilio Webhook] No matching report_card_history found for SID: ${messageSid}`);
        }

        return NextResponse.json({ success: true, messageSid, status: messageStatus });
    } catch (err: any) {
        console.error("[Twilio Webhook] Error processing status webhook:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
