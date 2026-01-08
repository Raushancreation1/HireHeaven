import axios from "axios";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";
import bcrypt from 'bcrypt';
import jwt from "jsonwebtoken";
import { forgotPasswordTemplate } from "../template.js";
import { publishTopic } from "../producer.js";
import { redisClient } from "../index.js";
export const registerUser = TryCatch(async (req, res, next) => {
    const { name, email, password, phoneNumber, role, bio } = req.body;
    if (!name || !email || !password || !phoneNumber || !role) {
        throw new ErrorHandler(400, "Please fill all derails ");
    }
    const existingUsers = await sql `SELECT user_id FROM users WHERE email = ${email}`;
    if (existingUsers.length > 0) {
        throw new ErrorHandler(409, " User with this email already exists");
    }
    const hashPassword = await bcrypt.hash(password, 10);
    let registeredUser;
    if (role === "recruiter ") {
        const [user] = await sql `INSERT INTO users (name, email, password, phone_number, role) VALUES
                                 (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}) RETURNING
                                 user_id, name, email, phone_number, role, created_at`;
        registeredUser = user;
    }
    else if (role === "jobseeker") {
        const file = req.file;
        if (!file) {
            throw new ErrorHandler(400, "Resume file is required for jobseekers ");
        }
        const fileBuffer = getBuffer(file);
        if (!fileBuffer || !fileBuffer.content) {
            throw new ErrorHandler(500, "Failed to generate buffer");
        }
        if (!process.env.UPLOAD_SERVICE) {
            throw new ErrorHandler(500, "UPLOAD_SERVICE environment variable is not configured");
        }
        // Ensure UPLOAD_SERVICE uses http:// not https:// for local development
        const uploadServiceUrl = process.env.UPLOAD_SERVICE.replace(/^https:\/\//, 'http://');
        let data;
        try {
            const response = await axios.post(`${uploadServiceUrl}/api/utils/upload`, { buffer: fileBuffer.content }, {
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            data = response.data;
        }
        catch (error) {
            const err = error || {};
            if (err?.code === 'EPROTO' || err?.message?.includes('wrong version number')) {
                throw new ErrorHandler(500, `SSL Error: UPLOAD_SERVICE must use http:// not https://. Current value: ${process.env.UPLOAD_SERVICE}`);
            }
            if (err?.code === 'ECONNREFUSED') {
                throw new ErrorHandler(500, `Connection refused: Cannot connect to upload service at ${uploadServiceUrl}. Make sure the utils service is running.`);
            }
            if (err?.response) {
                throw new ErrorHandler(err.response.status || 500, `Upload service error: ${err.response.data?.message || err.message}`);
            }
            throw new ErrorHandler(500, `Failed to upload file: ${err?.message || 'Unknown error'}`);
        }
        const [user] = await sql `INSERT INTO users (name, email, password, phone_number, role, bio, resume, resume_public_id ) VALUES
                                 (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}, ${bio}, ${data.url}, ${data.public_id}) RETURNING
                                 user_id, name, email, phone_number, role, bio, resume, created_at`;
        registeredUser = user;
    }
    res.json({
        message: "user Registerd ",
        registeredUser,
    });
});
export const loginUser = TryCatch(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new ErrorHandler(400, "Email and password are required");
    }
    const users = await sql `SELECT user_id, name, email, password, role, phone_number FROM users WHERE email = ${email}`;
    if (users.length === 0) {
        throw new ErrorHandler(401, "Invalid email or password");
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new ErrorHandler(401, "Invalid email or password");
    }
    const token = jwt.sign({ userId: user.user_id, email: user.email, role: user.role }, process.env.JWT_SEC, { expiresIn: "7d" });
    res.json({
        message: "Login successful",
        token,
        user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            phone_number: user.phone_number,
            role: user.role,
        },
    });
});
export const forgotPassword = TryCatch(async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        throw new ErrorHandler(400, "email is required");
    }
    const users = await sql `SELECT user_id, email FROM users WHERE email = ${email}`;
    if (users.length === 0) {
        return res.json({
            message: "If that exists, we have sent a reset link"
        });
    }
    const user = users[0];
    const resetToken = jwt.sign({
        email: user.email, type: "reset"
    }, process.env.JWT_SEC, { expiresIn: "15m" });
    const resetLink = `${process.env.Frontend_Url}/reset/${resetToken}`;
    // Store token in Redis (with error handling if Redis is unavailable)
    try {
        await redisClient.set(`forgot:${email}`, resetToken, {
            EX: 900,
        });
    }
    catch (error) {
        console.warn("⚠️  Failed to store reset token in Redis:", error);
        // Continue anyway - token is still valid, just won't be checkable in Redis
    }
    const message = {
        to: email,
        subject: "RESET Your Password - HireHeaven",
        html: forgotPasswordTemplate(resetLink),
    };
    publishTopic("send-mail", message).catch((error) => {
        console.log("failed to send", error);
    });
    res.json({
        message: "If that exists, we have sent a reset link"
    });
});
export const resetPassword = TryCatch(async (req, res, next) => {
    const { token } = req.params;
    const { password } = req.body;
    if (!password) {
        throw new ErrorHandler(400, "Password is required");
    }
    if (password.length < 6) {
        throw new ErrorHandler(400, "Password must be at least 6 characters long");
    }
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SEC);
    }
    catch (error) {
        throw new ErrorHandler(400, "Expired or invalid token");
    }
    if (decoded.type !== "reset") {
        throw new ErrorHandler(400, "Invalid token type");
    }
    const email = decoded.email;
    // Check token in Redis (with fallback if Redis is unavailable)
    let storedToken = null;
    try {
        storedToken = await redisClient.get(`forgot:${email}`);
    }
    catch (error) {
        console.warn("⚠️  Failed to get reset token from Redis:", error);
        // If Redis is unavailable, we'll skip Redis validation but still validate JWT
        // This allows password reset to work even if Redis is down
    }
    // Only validate against Redis if we successfully retrieved a token
    // If Redis is unavailable, we rely on JWT expiration (15 minutes)
    if (storedToken !== null && storedToken !== token) {
        throw new ErrorHandler(400, "Token has expired or is invalid");
    }
    const users = await sql `SELECT user_id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
        throw new ErrorHandler(404, "User not found");
    }
    const user = users[0];
    const hashPassword = await bcrypt.hash(password, 10);
    await sql `UPDATE users SET password = ${hashPassword} WHERE user_id = ${user.user_id}`;
    // Delete token from Redis (with error handling if Redis is unavailable)
    try {
        await redisClient.del(`forgot:${email}`);
    }
    catch (error) {
        console.warn("⚠️  Failed to delete reset token from Redis:", error);
        // Continue anyway - password is already reset
    }
    res.json({ message: "Password changed successfully" });
});
