import express from "express";
import authRoutes from "./routes/auth.js";
import { connectKafka } from "./producer.js";
import ErrorHandler from "./utils/ErrorHandler.js";
const app = express();
app.use(express.json());
// Connect to Kafka with error handling (async, but don't block app startup)
connectKafka().catch((error) => {
    // Error is already logged in connectKafka, just ensure app continues
    // App will work without Kafka, but email features won't be available
});
// Root route
app.get("/", (req, res) => {
    res.json({
        message: "Auth Service API",
        version: "1.0.0",
        endpoints: {
            register: "POST /api/auth/register"
        }
    });
});
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "auth",
        timestamp: new Date().toISOString()
    });
});
app.use("/api/auth", authRoutes);
// 404 handler for unmatched routes
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found",
        path: req.path,
        method: req.method
    });
});
// Global error handler middleware (must be last)
app.use((err, req, res, next) => {
    // Handle JSON parsing errors
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            message: "Invalid JSON payload",
            success: false
        });
    }
    // Handle custom ErrorHandler instances
    if (err instanceof ErrorHandler) {
        return res.status(err.statusCode).json({
            message: err.message,
            success: false
        });
    }
    // Handle other errors
    console.error("Global error handler:", err);
    const errorMessage = err?.message || err?.toString() || "Internal server error";
    res.status(err?.statusCode || 500).json({
        message: process.env.NODE_ENV === 'production'
            ? "Internal server error"
            : errorMessage,
        success: false
    });
});
export default app;
