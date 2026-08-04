import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(req: Request) {
    try {
        if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return NextResponse.json(
                { error: 'Razorpay keys are not configured in environment variables.' },
                { status: 500 }
            );
        }

        const razorpay = new Razorpay({
            key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const body = await req.json();
        const { amount, planName, planKey, type } = body;

        // amount is expected to be in paise (amountInRupees * 100)
        if (!amount || !planName) {
            return NextResponse.json(
                { error: 'Amount and plan name are required' },
                { status: 400 }
            );
        }

        const options = {
            amount: amount, 
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                planName,
                planKey: planKey || '',
                type: type || 'whatsapp_subscription'
            },
        };

        const order = await razorpay.orders.create(options);

        return NextResponse.json({
            id: order.id,
            amount: order.amount,
            currency: order.currency,
        });
    } catch (error: any) {
        console.error('Razorpay Order Error:', error);
        return NextResponse.json(
            { error: error.message || 'Something went wrong' },
            { status: 500 }
        );
    }
}
