import crypto from "crypto";

import PaymentTransaction from "../models/PaymentTransaction.js";
import activateSubscriptionFromPayment from "../utils/activateSubscriptionFromPayment.js";

/*
=========================================================
RAZORPAY WEBHOOK
POST /api/webhooks/razorpay

Razorpay's server calls this directly — no logged-in session
involved, which is why it sits outside authMiddleware entirely.
Safety net: if a payment is captured but the browser never
completes verify-payment (tab closed, network drop), this still
activates the subscription.

Configure in Razorpay Dashboard → Settings → Webhooks:
  URL:    https://your-domain.com/api/webhooks/razorpay
  Events: payment.captured, payment.failed
  Secret: put the same value in RAZORPAY_WEBHOOK_SECRET in .env
=========================================================
*/

const razorpayWebhookHandler = async (req, res) => {

    try {

        const signature = req.headers["x-razorpay-signature"];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error("RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook.");
            return res.status(500).json({ success: false, message: "Webhook secret not configured." });
        }

        if (!signature) {
            return res.status(400).json({ success: false, message: "Missing signature header." });
        }

        // req.body is a raw Buffer here (see app.js mounting) — verify against the exact bytes received
        const expectedSignature = crypto

            .createHmac("sha256", webhookSecret)

            .update(req.body)

            .digest("hex");

        if (expectedSignature !== signature) {
            console.warn("Razorpay webhook signature mismatch — possible spoofed request.");
            return res.status(400).json({ success: false, message: "Invalid signature." });
        }

        const event = JSON.parse(req.body.toString());

        const eventType = event.event;

        if (eventType === "payment.captured") {

            const payment = event.payload?.payment?.entity;

            if (!payment) {
                return res.status(200).json({ success: true, message: "No payment entity, ignored." });
            }

            const transaction = await PaymentTransaction.findOne({
                razorpay_order_id: payment.order_id
            });

            if (!transaction) {
                return res.status(200).json({ success: true, message: "Unknown order, ignored." });
            }

            // Idempotency guard — if the browser's verify-payment call already
            // handled this, don't reactivate/reset the subscription period again
            if (transaction.status !== "Paid") {

                transaction.razorpay_payment_id = payment.id;
                transaction.status = "Paid";
                await transaction.save();

                await activateSubscriptionFromPayment(transaction);

                console.log(`Webhook activated subscription for restaurant ${transaction.restaurant_id} via payment.captured`);

            }

        } else if (eventType === "payment.failed") {

            const payment = event.payload?.payment?.entity;

            if (payment) {

                const transaction = await PaymentTransaction.findOne({
                    razorpay_order_id: payment.order_id
                });

                if (transaction && transaction.status === "Created") {
                    transaction.status = "Failed";
                    transaction.failure_reason = payment.error_description || "Payment failed";
                    await transaction.save();
                }

            }

        }

        // Always acknowledge quickly — Razorpay retries on non-200s
        return res.status(200).json({ success: true, message: "Webhook processed." });

    } catch (error) {

        console.error("Razorpay webhook error:", error.message);
        return res.status(200).json({ success: false, message: "Webhook received but not fully processed." });

    }

};

export default razorpayWebhookHandler;