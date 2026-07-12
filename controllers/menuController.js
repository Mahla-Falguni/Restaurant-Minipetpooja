import MenuItem from "../models/MenuItem.js";
import Restaurant from "../models/Restaurant.js";
import Category from "../models/Category.js";
import Table from "../models/Table.js"
import deleteLocalFile from "../utils/deleteLocalFile.js";

import uploadToCloudinary from "../utils/uploadToCloudinary.js";
import sendResponse from "../utils/sendResponse.js";

/*
==================================
CREATE MENU ITEM
POST /api/menu/create
==================================
*/

export const createMenuItem = async (req, res, next) => {
    try {
        const {
            category_id,
            item_name,
            description,
            price,
            discount_price,
            food_type,
            preparation_time,
            calories,
            spice_level,
            is_available,
            is_recommended,
            is_best_seller,
        } = req.body;

        // Find Restaurant
        const restaurant = await Restaurant.findOne({ owner_id: req.user._id, });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant not found");
        }

        // Check Category
        const category = await Category.findOne({
            _id: category_id,
            restaurant_id: restaurant._id,
        });

        if (!category) {
            return sendResponse(res, 404, false, "Category not found");
        }

        let image = "";
        let image_public_id = "";

        if (req.file) {
            const uploaded =
                await uploadToCloudinary(req.file.buffer, "menu-items");
            image = uploaded.url;
            image_public_id = uploaded.public_id;
        }

        const menuItem =
            await MenuItem.create({
                restaurant_id: restaurant._id,
                category_id,
                item_name,
                description,
                image,
                image_public_id,
                price,
                discount_price,
                food_type,
                preparation_time,
                calories,
                spice_level,
                is_available,
                is_recommended,
                is_best_seller,
            });

        sendResponse(res, 201, true, "Menu Item Created Successfully", menuItem);
    }
    catch (error) { next(error); }
};


/*
=====================================
GET ALL MENU ITEMS
GET /api/menu
=====================================
*/

export const getMenuItems = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const restaurant = await Restaurant.findOne({ owner_id: req.user._id, });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        let query = { restaurant_id: restaurant._id, };

        // Category Filter
        if (req.query.category_id) {
            query.category_id = req.query.category_id;
        }

        // Search
        if (req.query.search) {
            query.item_name = { $regex: req.query.search, $options: "i", };
        }

        const total =
            await MenuItem.countDocuments(query);

        const menuItems =
            await MenuItem.find(query)
                .populate("category_id", "category_name")
                .sort({ createdAt: -1, })
                .skip(skip)
                .limit(limit);

        sendResponse(res, 200, true, "Menu Items Fetched",
            {
                menuItems,
                page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
            }
        );

    } catch (error) { next(error); }
};


/*
=====================================
GET SINGLE MENU ITEM
GET /api/menu/:id
=====================================
*/

export const getMenuItem = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id
            ).populate("category_id", "category_name");

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        sendResponse(res, 200, true, "Menu Item Found", menuItem);

    } catch (error) { next(error); }
};



/*
====================================
UPDATE MENU ITEM
PUT /api/menu/:id
====================================
*/

export const updateMenuItem = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        const restaurant =
            await Restaurant.findOne({ owner_id: req.user._id, });

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        if (
            menuItem.restaurant_id.toString() !== restaurant._id.toString()) {
            return sendResponse(res, 403, false, "Unauthorized");
        }

        // Category Validation
        if (req.body.category_id) {

            const category =
                await Category.findOne({ _id: req.body.category_id, restaurant_id: restaurant._id, });

            if (!category) {
                return sendResponse(res, 404, false, "Category Not Found");
            }

            menuItem.category_id = req.body.category_id;
        }

        // Replace Image
        if (req.file) {

            if (menuItem.image_public_id) {
                deleteLocalFile(menuItem.image_public_id);
            }

            const uploaded =
                await uploadToCloudinary(req.file.buffer, "menu-items");

            menuItem.image = uploaded.url;
            menuItem.image_public_id = uploaded.public_id;
        }

        menuItem.item_name = req.body.item_name ?? menuItem.item_name;
        menuItem.description = req.body.description ?? menuItem.description;
        menuItem.price = req.body.price ?? menuItem.price;
        menuItem.discount_price = req.body.discount_price ?? menuItem.discount_price;
        menuItem.food_type = req.body.food_type ?? menuItem.food_type;
        menuItem.preparation_time = req.body.preparation_time ?? menuItem.preparation_time;
        menuItem.calories = req.body.calories ?? menuItem.calories;
        menuItem.spice_level = req.body.spice_level ?? menuItem.spice_level;

        if (req.body.is_available !== undefined)
            menuItem.is_available = req.body.is_available;

        if (req.body.is_best_seller !== undefined)
            menuItem.is_best_seller = req.body.is_best_seller;

        if (req.body.is_recommended !== undefined)
            menuItem.is_recommended = req.body.is_recommended;

        await menuItem.save();

        sendResponse(res, 200, true, "Menu Item Updated Successfully", menuItem);

    } catch (error) { next(error); }
};


/*
=====================================
DELETE MENU ITEM
DELETE /api/menu/:id
=====================================
*/

export const deleteMenuItem = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        const restaurant =
            await Restaurant.findOne({ owner_id: req.user._id });

        if (
            menuItem.restaurant_id.toString() !== restaurant._id.toString()
        ) {
            return sendResponse(res, 403, false, "Unauthorized");
        }

        if (menuItem.image_public_id) {
            await cloudinary.uploader.destroy(menuItem.image_public_id);
        }

        await menuItem.deleteOne();

        sendResponse(res, 200, true, "Menu Item Deleted Successfully");

    } catch (error) { next(error); }
};



/*
=====================================
TOGGLE AVAILABILITY
PATCH /api/menu/availability/:id
=====================================
*/

export const toggleAvailability = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        menuItem.is_available = !menuItem.is_available;

        await menuItem.save();
        sendResponse(res, 200, true, "Availability Updated", menuItem);

    } catch (error) { next(error); }
};


/*
=====================================
BEST SELLER
PATCH /api/menu/best-seller/:id
=====================================
*/

export const toggleBestSeller = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        menuItem.is_best_seller = !menuItem.is_best_seller;

        await menuItem.save();
        sendResponse(res, 200, true, "Best Seller Updated", menuItem);

    } catch (error) { next(error); }
};



/*
=====================================
RECOMMENDED
PATCH /api/menu/recommended/:id
=====================================
*/

export const toggleRecommended = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        menuItem.is_recommended = !menuItem.is_recommended;

        await menuItem.save();
        sendResponse(res, 200, true, "Recommendation Updated", menuItem);

    } catch (error) { next(error); }
};



/*
=====================================
SOFT DELETE
PATCH /api/menu/soft-delete/:id
=====================================
*/

export const softDeleteMenu = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        menuItem.deleted_at = new Date();
        menuItem.status = false;

        await menuItem.save();
        sendResponse(res, 200, true, "Menu Item Archived");

    } catch (error) { next(error); }
};


/*
=====================================
RESTORE MENU
PATCH /api/menu/restore/:id
=====================================
*/

export const restoreMenu = async (req, res, next) => {
    try {
        const menuItem =
            await MenuItem.findById(req.params.id);

        if (!menuItem) {
            return sendResponse(res, 404, false, "Menu Item Not Found");
        }

        menuItem.deleted_at = null;
        menuItem.status = true;

        await menuItem.save();
        sendResponse(res, 200, true, "Menu Item Restored", menuItem);

    } catch (error) { next(error); }
};



/*
=====================================
BULK UPDATE
PATCH /api/menu/bulk-status
=====================================
*/

export const bulkUpdateStatus = async (req, res, next) => {
    try {
        const { ids, status } = req.body;

        await MenuItem.updateMany(
            { _id: { $in: ids } },
            { is_available: status }
        );

        sendResponse(res, 200, true, "Bulk Update Successful");

    } catch (error) { next(error); }
};



/*
====================================================
GET RESTAURANT DETAILS FROM TABLE QR
GET /api/public/table/:tableCode
====================================================
*/

export const getRestaurantByTable = async (req, res, next) => {
    try {
        const { tableCode } = req.params;

        const table = await Table.findOne({ table_code: tableCode });

        if (!table) {
            return sendResponse(res, 404, false, "Invalid QR Code");
        }

        const restaurant = await Restaurant.findById(table.restaurant_id);

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        sendResponse(res, 200, true, "Restaurant Found", { restaurant, table });

    } catch (error) { next(error); }
};


/*
===================================
PUBLIC MENU FOR CUSTOMER QR PAGE
GET /api/public/menu/:restaurantId
Returns active categories with their available items nested inside,
ready for the customer menu page to render directly — no auth required.
===================================
*/
export const getPublicMenu = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const restaurant = await Restaurant.findById(restaurantId);

        if (!restaurant) {
            return sendResponse(res, 404, false, "Restaurant Not Found");
        }

        const categories = await Category.find({
            restaurant_id: restaurantId,
            status: true,
        }).sort({ createdAt: 1 });

        const items = await MenuItem.find({
            restaurant_id: restaurantId,
            status: true,
            is_available: true,
        }).sort({ item_name: 1 });

        const menu = categories.map((category) => ({
            _id: category._id,
            category_name: category.category_name,
            description: category.description,
            items: items.filter(
                (item) => item.category_id.toString() === category._id.toString()
            ),
        })).filter((category) => category.items.length > 0);

        sendResponse(res, 200, true, "Menu Fetched", menu);

    } catch (error) { next(error); }
};