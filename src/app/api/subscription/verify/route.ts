import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey, amount, type, schoolKey } = body;

        const text = `${razorpay_order_id}|${razorpay_payment_id}`;
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(text)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return NextResponse.json(
                { success: false, error: 'Invalid signature' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        if (type === 'whatsapp_topup') {
            // Fetch current credit and update to avoid UUID cast errors in the RPC
            const { data: subData, error: fetchError } = await supabase
                .from('subscriptions')
                .select('whatsappcredit')
                .eq('schoolkey', schoolKey)
                .single();
                
            if (fetchError) throw fetchError;

            const newCredit = (subData?.whatsappcredit || 0) + amount;

            const { error: updateError } = await supabase
                .from('subscriptions')
                .update({ whatsappcredit: newCredit })
                .eq('schoolkey', schoolKey);

            if (updateError) throw updateError;
        } else {
            // whatsapp_subscription
            const now = new Date();
            
            const { data: currentSub } = await supabase
                .from('subscriptions')
                .select('whatsappenddate, whatsappstartdate')
                .eq('schoolkey', schoolKey)
                .maybeSingle();

            let baseDate = now;
            if (currentSub?.whatsappenddate && new Date(currentSub.whatsappenddate) > now) {
                baseDate = new Date(currentSub.whatsappenddate);
            }

            let endDate = new Date(baseDate);
            if (planKey === 'yearly') {
                endDate.setFullYear(endDate.getFullYear() + 1);
            } else {
                endDate.setMonth(endDate.getMonth() + 1);
            }

            const startDate = currentSub?.whatsappstartdate || now.toISOString();

            const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                    whatsappstartdate: startDate,
                    whatsappenddate: endDate.toISOString(),
                    isactive: true,
                    status: 'active'
                })
                .eq('schoolkey', schoolKey);

            if (updateError) throw updateError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Razorpay Verify Error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Verification failed' },
            { status: 500 }
        );
    }
}
