import jwt from 'jsonwebtoken';
import { sql } from "../utils/db.js";
export const isAuth = async (req, res, next) => {
    try {
        // Accept different header casings and array form
        const authHeaderRaw = req.headers.authorization ||
            req.headers["Authorization"] ||
            req.headers["AUTHORIZATION"];
        const authHeader = Array.isArray(authHeaderRaw)
            ? authHeaderRaw[0]
            : authHeaderRaw;
        // Validate header presence
        if (!authHeader || typeof authHeader !== "string") {
            res.status(401).json({
                message: "Authorization header is missing or invalid",
            });
            return;
        }
        const normalized = authHeader.trim();
        // Validate Bearer format (case-insensitive)
        if (!normalized.toLowerCase().startsWith("bearer ")) {
            res.status(401).json({
                message: "Authorization header is missing or invalid",
            });
            return;
        }
        // Extract token part
        const token = normalized.split(" ").slice(1).join(" ").trim();
        if (!token) {
            res.status(401).json({
                message: "Authorization header is missing or invalid",
            });
            return;
        }
        // Check if JWT secret is configured
        if (!process.env.JWT_SEC) {
            console.error("JWT_SEC environment variable is not set");
            res.status(500).json({
                message: "Server configuration error",
            });
            return;
        }
        const decodedPayload = jwt.verify(token, process.env.JWT_SEC);
        if (!decodedPayload || !decodedPayload.userId) {
            res.status(401).json({
                message: "invalid Token",
            });
            return;
        }
        const users = await sql `
        SELECT u.user_id,
               u.name,
               u.email,
               u.phone_number,
               u.role,
               u.bio,
               u.resume,
               u.resume_public_id,
               u.profile_pic,
               u.profile_pic_public_id,
               u.subscription,
               ARRAY_AGG(s.name) FILTER(WHERE s.name IS NOT NULL) as skills
        FROM users u
        LEFT JOIN user_skills us ON u.user_id = us.user_id
        LEFT JOIN skills s ON us.skill_id = s.skill_id
        WHERE u.user_id = ${decodedPayload.userId}
        GROUP BY u.user_id; `;
        if (users.length === 0) {
            res.status(401).json({
                message: "User associated with this no longer exists.",
            });
            return;
        }
        const user = users[0];
        user.skills = user.skills || [];
        req.user = user;
        next();
    }
    catch (error) {
        console.error("Authentication error:", error);
        // Handle specific JWT errors
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                message: "Invalid token. Please login again",
            });
            return;
        }
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                message: "Token expired. Please login again",
            });
            return;
        }
        res.status(401).json({
            message: "Authentication Failed. Please login again"
        });
    }
};
