import Restaurant from "../models/Restaurant.js";
import RestaurantSettings from "../models/RestaurantSettings.js";
import sendResponse from "../utils/sendResponse.js";

/*
=========================================================
RESTAURANT SETTINGS
Drives order-time tax %, service charge %, allowed payment
methods, auto-accept, and prep-time estimate — see
orderController.js's RestaurantSettings.findOne() calls.
No route previously existed to let an owner actually view
or edit these; orders silently fell back to hardcoded
defaults (5% GST, all payment methods) forever.
=========================================================
*/

const DEFAULTS = {
    gst_percentage: 5,
    service_charge_percentage: 0,
    currency: "INR",
    allow_cash: true,
    allow_upi: true,
    allow_card: true,
    allow_online: true,
    auto_accept_orders: false,
    estimated_preparation_time: 20,
};

/*
===================================
CREATE RESTAURANT
POST /api/restaurants/create
===================================
*/

export const createRestaurant = async (req, res, next) => {
    try {
        // One restaurant per owner — don't let an Admin create duplicates
        const existing = await Restaurant.findOne({ owner_id: req.user._id });
        if (existing) {
            return sendResponse(res, 409, false, "Restaurant Already Exists For This Owner");
        }

        const { name, description, phone, email, address, city, state, pincode } = req.body;

        if (!name || !phone || !address) {
            return sendResponse(res, 400, false, "Name, Phone And Address Are Required");
        }

        const restaurant = await Restaurant.create({
            owner_id: req.user._id,
            name,
            description,
            phone,
            email,
            address,
            city,
            state,
            pincode,
        });

        sendResponse(res, 201, true, "Restaurant Created", restaurant);
    } catch (error) {
        next(error);
    }
};

/*
===================================
GET PROFILE
GET /api/restaurants/profile
===================================
*/

export const getRestaurantProfile = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        sendResponse(res, 200, true, "Restaurant Profile", restaurant);
    } catch (error) {
        next(error);
    }
};

/*
===================================
UPDATE RESTAURANT
PUT /api/restaurants/update
===================================
*/

export const updateRestaurant = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        const { name, description, phone, email, address, city, state, pincode } = req.body;

        // Only touch fields that were actually sent
        if (name !== undefined) restaurant.name = name;
        if (description !== undefined) restaurant.description = description;
        if (phone !== undefined) restaurant.phone = phone;
        if (email !== undefined) restaurant.email = email;
        if (address !== undefined) restaurant.address = address;
        if (city !== undefined) restaurant.city = city;
        if (state !== undefined) restaurant.state = state;
        if (pincode !== undefined) restaurant.pincode = pincode;

        await restaurant.save();

        sendResponse(res, 200, true, "Restaurant Updated", restaurant);
    } catch (error) {
        next(error);
    }
};

/*
===================================
UPLOAD LOGO
POST /api/restaurants/logo
===================================
*/

export const uploadLogo = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        if (!req.file) {
            return sendResponse(res, 400, false, "No Logo File Uploaded");
        }

        // Adjust this path/field to match how uploadMiddleware.js stores files
        // (e.g. req.file.path for disk storage, or a cloud URL if you upload to S3/Cloudinary)
        restaurant.logo = req.file.path;
        await restaurant.save();

        sendResponse(res, 200, true, "Logo Uploaded", { logo: restaurant.logo });
    } catch (error) {
        next(error);
    }
};

/*
===================================
GET SETTINGS
GET /api/restaurants/settings
===================================
*/

export const getRestaurantSettings = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        let settings = await RestaurantSettings.findOne({
            restaurant_id: restaurant._id,
        });

        // No settings doc yet — hand back defaults without creating one,
        // so an untouched restaurant doesn't get a stray DB row.
        if (!settings) {
            return sendResponse(res, 200, true, "Default Settings", {
                restaurant_id: restaurant._id,
                ...DEFAULTS,
            });
        }

        sendResponse(res, 200, true, "Restaurant Settings", settings);
    } catch (error) {
        next(error);
    }
};

/*
===================================
UPDATE SETTINGS (upsert)
PUT /api/restaurants/settings
===================================
*/

export const updateRestaurantSettings = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        const {
            gst_percentage,
            service_charge_percentage,
            currency,
            allow_cash,
            allow_upi,
            allow_card,
            allow_online,
            auto_accept_orders,
            estimated_preparation_time,
        } = req.body;

        const settings = await RestaurantSettings.findOneAndUpdate(
            { restaurant_id: restaurant._id },
            {
                restaurant_id: restaurant._id,
                gst_percentage,
                service_charge_percentage,
                currency,
                allow_cash,
                allow_upi,
                allow_card,
                allow_online,
                auto_accept_orders,
                estimated_preparation_time,
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        sendResponse(res, 200, true, "Settings Updated", settings);
    } catch (error) {
        next(error);
    }
};