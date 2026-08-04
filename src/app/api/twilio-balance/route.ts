import { NextResponse } from "next/server";

export async function GET() {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
            return NextResponse.json({ error: "Missing Twilio credentials" }, { status: 500 });
        }

        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            },
            // Disable cache to always get the live balance
            cache: 'no-store'
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ error: data.message || "Failed to fetch balance" }, { status: response.status });
        }

        return NextResponse.json({
            balance: data.balance,
            currency: data.currency
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
