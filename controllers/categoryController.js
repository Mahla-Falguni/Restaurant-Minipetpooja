import Category from "../models/Category.js";
import Restaurant from "../models/Restaurant.js";

import sendResponse from "../utils/sendResponse.js";
import uploadToCloudinary from "../utils/uploadToCloudinary.js";

/*
==========================
CREATE CATEGORY
==========================
*/

export const createCategory = async (req, res, next) => {
    try {
        const { category_name, description } = req.body;

        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        let image = "";

        if (req.file) {
            const uploaded =
                await uploadToCloudinary(req.file.buffer, "categories");
            image = uploaded.secure_url;
        }

        const category = await Category.create({
            restaurant_id: restaurant._id,
            category_name,
            description,
            image
        });

        sendResponse(res, 201, true, "Category Created", category);

    } catch (error) { next(error); }
};


export const getCategories = async (req, res, next) => {
    try {
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id });

        const categories = await Category.find({
            restaurant_id: restaurant._id
        }).sort({ createdAt: -1 });

        sendResponse(res, 200, true, "Categories Fetched", categories);

    } catch (error) { next(error); }
};


export const getCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return sendResponse(res, 404, false, "Category Not Found");
        }

        sendResponse(res, 200, true, "Category Found", category);

    } catch (error) { next(error); }
};


export const updateCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return sendResponse(res, 404, false, "Category Not Found");
        }
        Object.assign(category, req.body);

        await category.save();

        sendResponse(res, 200, true, "Category Updated", category);
    } catch (error) { next(error); }
};


export const deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return sendResponse(res, 404, false, "Category Not Found");
        }

        await category.deleteOne();
        sendResponse(res, 200, true, "Category Deleted");

    } catch (error) { next(error); }
};