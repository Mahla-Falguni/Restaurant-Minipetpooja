import RestaurantSubscription from "../models/RestaurantSubscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";

/*
=========================================================
ACTIVATE SUBSCRIPTION FROM A PAID TRANSACTION
Given a PaymentTransaction that has just been confirmed as
genuinely paid (signature checked, by whichever caller), this
does the actual subscription upsert. Shared by:
  - verifySubscriptionPayment (browser-triggered, fast path)
  - the Razorpay webhook (server-triggered, safety net)
so the two can never activate a subscription differently.
=========================================================
*/

const activateSubscriptionFromPayment = async (transaction) => {

    const plan = await SubscriptionPlan.findById(transaction.plan_id);

    if (!plan) {
        throw new Error("Plan referenced by this payment no longer exists.");
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);

    if (plan.billing_cycle === "Yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await RestaurantSubscription.findOneAndUpdate(

        { restaurant_id: transaction.restaurant_id },

        {
            $set: {
                plan_id: plan._id,
                status: "Active",
                current_period_start: periodStart,
                current_period_end: periodEnd,
                auto_renew: true,
                last_payment_amount: transaction.amount,
                last_payment_at: periodStart,
                suspended_reason: ""
            }
        },

        { upsert: true, new: true, setDefaultsOnInsert: true }

    ).populate("plan_id");

    return subscription;

};

export default activateSubscriptionFromPayment;