import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import userRoutes from "./routes/uesr.js";

dotenv.config();

const app = express();

// Enable CORS to allow requests from different origins
app.use(cors({
    origin: true, // Allow all origins (change in production)
    credentials: true,
    exposedHeaders: ['Authorization']
}));

// Parse JSON bodies and surface malformed JSON nicely
app.use(express.json());
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({ message: "Invalid JSON payload" });
    }
    next(err);
});

app.use("/api/user",userRoutes);

app.listen(process.env.PORT, () => {
    console.log(`User service is running on http://localhost:${process.env.PORT}`);
})