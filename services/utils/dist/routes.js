import express from "express";
import cloudinary from 'cloudinary';
const router = express.Router();
router.post("/upload", async (req, res) => {
    try {
        const { buffer, public_id } = req.body;
        // Validate buffer is provided
        if (!buffer) {
            return res.status(400).json({
                success: false,
                message: "Buffer is required",
                error: "Missing buffer in request body"
            });
        }
        // Validate buffer is a string (data URI)
        if (typeof buffer !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Buffer must be a data URI string",
                error: `Expected string, received ${typeof buffer}`
            });
        }
        // Delete old file if public_id is provided
        if (public_id) {
            try {
                await cloudinary.v2.uploader.destroy(public_id);
            }
            catch (destroyError) {
                console.error("Error destroying old file:", destroyError.message);
                // Continue with upload even if destroy fails
            }
        }
        // Upload to Cloudinary
        const cloud = await cloudinary.v2.uploader.upload(buffer, {
            resource_type: "auto", // Automatically detect file type
        });
        res.json({
            success: true,
            url: cloud.secure_url,
            public_id: cloud.public_id,
        });
    }
    catch (error) {
        console.error("Upload error:", error);
        // Handle specific Cloudinary errors
        if (error.http_code) {
            return res.status(error.http_code || 500).json({
                success: false,
                message: "Cloudinary upload failed",
                error: error.message,
                details: error.error || "Unknown Cloudinary error"
            });
        }
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: error.message
            });
        }
        // Generic error
        res.status(500).json({
            success: false,
            message: "Upload service error",
            error: error.message || "Unknown error occurred",
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
export default router;
