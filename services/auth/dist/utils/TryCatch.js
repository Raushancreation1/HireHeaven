import ErrorHandler from "./ErrorHandler.js";
export const TryCatch = (controller) => async (req, res, next) => {
    try {
        await controller(req, res, next);
    }
    catch (error) {
        // Handle custom ErrorHandler instances
        if (error instanceof ErrorHandler) {
            return res.status(error.statusCode).json({
                message: error.message || "An error occurred",
                success: false
            });
        }
        // Handle other errors
        console.error("Unhandled error:", error);
        // Check if error has a message
        const errorMessage = error?.message || error?.toString() || "Internal server error";
        res.status(500).json({
            message: process.env.NODE_ENV === 'production'
                ? "Internal server error"
                : errorMessage,
            success: false
        });
    }
};
