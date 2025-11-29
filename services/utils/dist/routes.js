import express from "express";
import cloudianary from 'cloudinary';
const router = express.Router();
router.post("/upload", async (req, res) => {
    try {
        const { buffer, public_id, } = req.body;
        if (public_id) {
            await cloudianary.v2.uploader.destroy(public_id);
        }
        const cloud = await cloudianary.v2.uploader.upload(buffer);
        res.json({
            url: cloud.secure_url,
            public_id: cloud.public_id,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});
export default router;
