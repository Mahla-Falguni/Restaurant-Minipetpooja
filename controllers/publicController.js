import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";
import Reservation from "../models/Reservation.js";
import Customer from "../models/Customer.js";
import sendResponse from "../utils/sendResponse.js";

// GET all active restaurants
export const getPublicRestaurants = async (req, res, next) => {
  try {
    const restaurants = await Restaurant.find({ status: "Active" }).select("restaurant_name email phone address city state logo");
    sendResponse(res, 200, true, "Restaurants fetched successfully", restaurants);
  } catch (error) {
    next(error);
  }
};

// GET tables for a specific restaurant to view occupancy
export const getPublicRestaurantTables = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tables = await Table.find({ restaurant_id: id, is_active: true }).select("table_number seating_capacity zone status");
    sendResponse(res, 200, true, "Tables fetched successfully", tables);
  } catch (error) {
    next(error);
  }
};

// POST a public guest reservation
export const createPublicReservation = async (req, res, next) => {
  try {
    const {
      restaurant_id,
      customer_name,
      customer_phone,
      party_size,
      reservation_date,
      reservation_time,
      duration_minutes,
      zone_preference,
      special_requests
    } = req.body;

    if (!restaurant_id || !customer_name || !customer_phone || !party_size || !reservation_date || !reservation_time) {
      return sendResponse(res, 400, false, "Restaurant, customer name, phone, party size, date, and time are required.");
    }

    const duration = duration_minutes || 90;

    // Check if customer exists in the database for CRM link
    const existingCustomer = await Customer.findOne({
      restaurant_id,
      phone: customer_phone.trim()
    });

    const reservation = await Reservation.create({
      restaurant_id,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_id: existingCustomer ? existingCustomer._id : null,
      party_size,
      reservation_date,
      reservation_time,
      duration_minutes: duration,
      tables_assigned: [],
      zone_preference: zone_preference || "",
      special_requests: special_requests || "",
      source: "Website",
      status: "Requested",
    });

    sendResponse(res, 201, true, "Reservation requested successfully. We will contact you to confirm.", reservation);
  } catch (error) {
    next(error);
  }
};
