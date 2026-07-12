import LeaveRequest from "../models/LeaveRequest.js";
import Attendance from "../models/Attendance.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
APPLY FOR LEAVE (self)
POST /api/staff/leave/apply
=========================================================
*/

export const applyLeave = async (req, res, next) => {

    try {

        const { leave_type, from_date, to_date, reason } = req.body;

        if (!leave_type || !from_date || !to_date || !reason) {
            throw new Error("Leave type, dates, and reason are required.");
        }

        if (new Date(from_date) > new Date(to_date)) {
            throw new Error("From date cannot be after to date.");
        }

        const leave = await LeaveRequest.create({
            restaurant_id: req.user.restaurant_id,
            staff_id: req.user.id,
            leave_type,
            from_date,
            to_date,
            reason
        });

        sendResponse(res, 201, true, "Leave request submitted successfully.", leave);

    } catch (error) { next(error); }

};

/*
=========================================================
GET LEAVE REQUESTS
GET /api/staff/leave?status=Pending&staff_id=...
=========================================================
*/

export const getLeaveRequests = async (req, res, next) => {

    try {

        const { status, staff_id, page = 1, limit = 20 } = req.query;
        const filter = { restaurant_id: req.user.restaurant_id };

        if (["Manager", "Admin"].includes(req.user.role)) {

            if (staff_id) filter.staff_id = staff_id;

        } else {
            filter.staff_id = req.user.id;
        }

        if (status) filter.status = status;

        const skip = (Number(page) - 1) * Number(limit);

        const [leaves, total] = await Promise.all([

            LeaveRequest.find(filter)
                .populate("staff_id", "first_name last_name role")
                .populate("reviewed_by", "first_name last_name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),

            LeaveRequest.countDocuments(filter)

        ]);

        sendResponse(res, 200, true, "Leave requests fetched successfully.", {

            leaves,

            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }

        });

    } catch (error) { next(error); }

};

/*
=========================================================
REVIEW LEAVE REQUEST (Manager/Admin)
PUT /api/staff/leave/:id/review
=========================================================
*/

export const reviewLeaveRequest = async (req, res, next) => {

    try {

        const { id } = req.params;

        const { status, remarks } = req.body;

        if (!["Approved", "Rejected"].includes(status)) {
            throw new Error("Status must be either Approved or Rejected.");
        }

        const leave = await LeaveRequest.findOne({
            _id: id,
            restaurant_id: req.user.restaurant_id
        });

        if (!leave) {
            throw new Error("Leave request not found.");
        }

        if (leave.status !== "Pending") {
            throw new Error(`This leave request has already been ${leave.status.toLowerCase()}.`);
        }

        leave.status = status;
        leave.review_remarks = remarks || "";
        leave.reviewed_by = req.user.id;
        leave.reviewed_at = new Date();

        await leave.save();

        // If approved, mark attendance as "On Leave" for each day in range

        if (status === "Approved") {

            const start = new Date(leave.from_date);
            const end = new Date(leave.to_date);
            const dates = [];

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toISOString().split("T")[0]);
            }

            for (const date of dates) {

                await Attendance.findOneAndUpdate(

                    {
                        restaurant_id: leave.restaurant_id,
                        staff_id: leave.staff_id,
                        date
                    },

                    {
                        $set: {
                            status: "On Leave",
                            marked_by: req.user.id
                        }
                    },

                    { upsert: true }

                );
            }
        }

        sendResponse(res, 200, true, `Leave request ${status.toLowerCase()} successfully.`, leave);

    } catch (error) { next(error); }

};

/*
=========================================================
CANCEL LEAVE REQUEST (self, only if still Pending)
PUT /api/staff/leave/:id/cancel
=========================================================
*/

export const cancelLeaveRequest = async (req, res, next) => {

    try {

        const { id } = req.params;

        const leave = await LeaveRequest.findOne({
            _id: id,
            staff_id: req.user.id,
            restaurant_id: req.user.restaurant_id
        });

        if (!leave) {
            throw new Error("Leave request not found.");
        }

        if (leave.status !== "Pending") {
            throw new Error("Only pending leave requests can be cancelled.");
        }

        leave.status = "Cancelled";

        await leave.save();

        sendResponse(res, 200, true, "Leave request cancelled successfully.", leave);

    } catch (error) { next(error) }

};