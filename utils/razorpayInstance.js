import Razorpay from "razorpay";

/*
=========================================================
RAZORPAY CLIENT
Reads keys from env. Requires in .env:
  RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
  RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx

Get test keys from the Razorpay Dashboard → Settings → API Keys.
=========================================================
*/

let razorpayInstance = null;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn(
        "⚠️  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in environment — payment routes will fail until they're added."
    );
    razorpayInstance = new Proxy({}, {
        get(target, prop) {
            throw new Error("Razorpay is not initialized because credentials are missing from environment variables.");
        }
    });
} else {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

export default razorpayInstance;