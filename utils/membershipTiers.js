/*
=========================================
MEMBERSHIP TIER CONFIGURATION
=========================================
*/

export const TIER_THRESHOLDS = [
    { tier: "Platinum", minSpend: 100000, pointsMultiplier: 2 },
    { tier: "Gold", minSpend: 50000, pointsMultiplier: 1.5 },
    { tier: "Silver", minSpend: 20000, pointsMultiplier: 1.25 },
    { tier: "Bronze", minSpend: 5000, pointsMultiplier: 1 },
    { tier: "None", minSpend: 0, pointsMultiplier: 1 }
];

// Points earned per ₹100 spent, before tier multiplier

export const BASE_POINTS_PER_100 = 1;

export const getTierForSpend = (totalSpent) => {

    for (const level of TIER_THRESHOLDS) {

        if (totalSpent >= level.minSpend) {

            return level.tier;

        }

    }

    return "None";

};

export const getMultiplierForTier = (tier) => {

    const match = TIER_THRESHOLDS.find((t) => t.tier === tier);

    return match ? match.pointsMultiplier : 1;

};

export const calculateEarnedPoints = (amountSpent, tier) => {

    const basePoints = Math.floor(amountSpent / 100) * BASE_POINTS_PER_100;

    const multiplier = getMultiplierForTier(tier);

    return Math.floor(basePoints * multiplier);

};