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

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn(
        "⚠️  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set in .env — payment routes will fail until they're added."
    );
}

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

export default razorpayInstance;