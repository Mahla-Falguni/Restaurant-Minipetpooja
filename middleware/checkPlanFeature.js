import RestaurantSubscription from "../models/RestaurantSubscription.js";

/*
=========================================================
PLAN FEATURE GATE
Usage: requireFeature("Reservations"), requireFeature("KDS"), etc.

Looks up the requesting user's restaurant subscription, checks
it's still usable (Active/Trial and not past its period end),
and confirms the named feature is part of that plan's
features_included list. Feature names must match exactly what
Super Admin typed into the plan's "Features" field
(e.g. "POS", "KDS", "QR Menu", "Reservations", "Customer CRM",
"Staff & Payroll", "Sales Reports", "GST Reports").
=========================================================
*/

const isSubscriptionUsable = (subscription) => {

    if (!subscription) return false;

    if (!["Active", "Trial"].includes(subscription.status)) return false;

    if (subscription.current_period_end && new Date(subscription.current_period_end) < new Date()) {
        return false;
    }

    return true;

};

const requireFeature = (featureName) => {

    return async (req, res, next) => {

        try {

            if (!req.user?.restaurant_id) {
                return res.status(403).json({
                    success: false,
                    message: "No restaurant is linked to this account."
                });
            }

            const subscription = await RestaurantSubscription
                .findOne({ restaurant_id: req.user.restaurant_id })
                .populate("plan_id");

            const usable = isSubscriptionUsable(subscription) && subscription.plan_id;

            const features = usable ? (subscription.plan_id.features_included || []) : [];

            if (!features.includes(featureName)) {

                return res.status(403).json({
                    success: false,
                    message: `Your current plan does not include "${featureName}". Upgrade your subscription to unlock this feature.`,
                    feature_required: featureName,
                    upgrade_required: true
                });

            }

            req.planFeatures = features;

            next();

        } catch (error) { next(error); }

    };

};

export default requireFeature;