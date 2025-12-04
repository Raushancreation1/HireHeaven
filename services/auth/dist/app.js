import express from "express";
import authRoutes from "./routes/auth.js";
import { connectKafka } from "./producer.js";
const app = express();
app.use(express.json());
connectKafka();
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
export default app;
