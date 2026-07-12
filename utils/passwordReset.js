import crypto from "crypto";

import sendResponse from "./sendResponse.js";

/*
=========================================================
SHARED PASSWORD RESET ENGINE
Both the restaurant-side User model (Admin/Manager/Waiter/
Cashier/Kitchen — they all log in the same way, so they all
reset the same way) and the SuperAdmin model need identical
forgot/verify/reset logic. Rather than write it twice, this
factory takes a model + a couple of small model-specific hooks
and returns the three route handlers.

No email service is wired up yet, so the reset link is logged
to the server console (same approach as your old project) —
copy it from there during development. Swap the console.log for
a real mailer call later without touching anything else here.

SECURITY NOTES:
- We store a SHA-256 hash of the token, never the raw token —
  if the DB ever leaked, the tokens in it would be useless.
- forgotPassword always returns the same generic message whether
  or not the email exists, so this endpoint can't be used to
  find out which emails are registered.
=========================================================
*/

const RESET_TOKEN_TTL_MINUTES = 15;

const hashToken = (rawToken) =>
    crypto.createHash("sha256").update(rawToken).digest("hex");

const createPasswordResetControllers = ({
    Model,
    frontendResetPath,
    getDisplayName,
    setPassword
}) => {

    /*
    =====================================================
    FORGOT PASSWORD
    body: { email }
    =====================================================
    */
    const forgotPassword = async (req, res, next) => {

        try {

            const { email } = req.body;

            if (!email || !email.trim()) {
                throw new Error("Email is required.");
            }

            const genericMessage = "If an account with that email exists, a reset link has been sent.";

            const doc = await Model.findOne({ email: email.toLowerCase().trim() });

            // Deliberately don't reveal whether the account exists — same response either way
            if (!doc) {
                return sendResponse(res, 200, true, genericMessage, null);
            }

            const rawToken = crypto.randomBytes(32).toString("hex");

            doc.reset_password_token = hashToken(rawToken);
            doc.reset_password_expires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

            await doc.save({ validateBeforeSave: false });

            const resetLink = `${process.env.FRONTEND_URL}${frontendResetPath}/${rawToken}`;

            // TODO: replace this console.log with a real email send once a mail service is wired up
            console.log("\n=================== PASSWORD RESET LINK ===================");
            console.log(`To:      ${doc.email}`);
            console.log(`Link:    ${resetLink}`);
            console.log(`Expires: ${doc.reset_password_expires.toISOString()} (in ${RESET_TOKEN_TTL_MINUTES} min)`);
            console.log("=============================================================\n");

            sendResponse(res, 200, true, genericMessage, null);

        } catch (error) {

            next(error);

        }

    };

    /*
    =====================================================
    VERIFY RESET TOKEN (frontend calls this on page load
    to decide whether to show the "set new password" form
    or an "invalid/expired link" state)
    GET /:token
    =====================================================
    */
    const verifyResetToken = async (req, res, next) => {

        try {

            const { token } = req.params;

            if (!token) {
                return res.status(200).json({ valid: false, message: "No reset token provided." });
            }

            const doc = await Model.findOne({
                reset_password_token: hashToken(token),
                reset_password_expires: { $gt: new Date() }
            }).select("+reset_password_token +reset_password_expires");

            if (!doc) {
                return res.status(200).json({
                    valid: false,
                    message: "This link is invalid or has expired."
                });
            }

            return res.status(200).json({
                valid: true,
                name: getDisplayName(doc)
            });

        } catch (error) {

            next(error);

        }

    };

    /*
    =====================================================
    RESET PASSWORD
    body: { new_password, confirm_password }
    params: :token
    =====================================================
    */
    const resetPassword = async (req, res, next) => {

        try {

            const { token } = req.params;
            const { new_password, confirm_password } = req.body;

            if (!new_password || new_password.length < 6) {
                throw new Error("Password must be at least 6 characters.");
            }

            if (new_password !== confirm_password) {
                throw new Error("Passwords do not match.");
            }

            const doc = await Model.findOne({
                reset_password_token: hashToken(token),
                reset_password_expires: { $gt: new Date() }
            }).select("+reset_password_token +reset_password_expires +password");

            if (!doc) {
                throw new Error("This link is invalid or has expired. Please request a new one.");
            }

            await setPassword(doc, new_password);

            doc.reset_password_token = undefined;
            doc.reset_password_expires = undefined;

            await doc.save({ validateModifiedOnly: true });

            sendResponse(res, 200, true, "Password reset successfully. You can now log in.", null);

        } catch (error) {

            next(error);

        }

    };

    return { forgotPassword, verifyResetToken, resetPassword };

};

export default createPasswordResetControllers;