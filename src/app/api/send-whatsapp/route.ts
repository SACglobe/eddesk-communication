import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(req: NextRequest) {
    try {
        const { mobile, message, templateParams } = await req.json();

        // Validate inputs
        if (!mobile || typeof mobile !== "string" || !/^\d{10}$/.test(mobile)) {
            return NextResponse.json(
                { success: false, error: "Invalid mobile number. Must be exactly 10 digits." },
                { status: 400 }
            );
        }

        if (!message || typeof message !== "string" || !message.trim()) {
            return NextResponse.json(
                { success: false, error: "Message cannot be empty." },
                { status: 400 }
            );
        }

        // Verify Twilio env vars are configured
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

        if (!accountSid || !authToken || !fromNumber) {
            console.error("Twilio env vars not configured.");
            return NextResponse.json(
                { success: false, error: "WhatsApp service is not configured. Contact the administrator." },
                { status: 500 }
            );
        }

        const client = twilio(accountSid, authToken);

        // Prepend India country code (+91) to the 10-digit number
        const toNumber = `whatsapp:+91${mobile}`;

        let statusCallbackUrl = process.env.TWILIO_STATUS_CALLBACK;
        if (!statusCallbackUrl && process.env.NEXT_PUBLIC_APP_URL) {
            statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio-status`;
        }

        let createOptions: any = {
            from: fromNumber,
            to: toNumber,
            body: message.trim(),
        };

        if (templateParams) {
            createOptions = {
                from: fromNumber,
                to: toNumber,
                contentSid: 'HX3ad3d5530076a864ee1183522b1e1253',
                contentVariables: JSON.stringify(templateParams)
            };
        }

        if (statusCallbackUrl) {
            createOptions.statusCallback = statusCallbackUrl;
        }

        const result = await client.messages.create(createOptions);

        console.log(`WhatsApp message sent. SID: ${result.sid}, Status: ${result.status}`);

        return NextResponse.json({ 
            success: true, 
            sid: result.sid, 
            status: result.status || "queued" 
        });
    } catch (err: unknown) {
        console.error("Twilio API error:", err);
        const errorMessage =
            err instanceof Error ? err.message : "Failed to send WhatsApp message.";
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
