/*
=========================================
ROLE CHECK MIDDLEWARE
Usage: checkRole("Cashier", "Manager", "Admin")
=========================================
*/

const checkRoleMiddleware = (...allowedRoles) => {

    return (req, res, next) => {

        try {

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized. Please log in."
                });
            }

            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to perform this action."
                });
            }

            next();

        } catch (error) { next(error) }

    };

};

export default checkRoleMiddleware;