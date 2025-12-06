import expreess from "express"
import dotenv from "dotenv"
import userRoutes from "./routes/uesr.js";

dotenv.config();

const app = expreess();
app.use(expreess.json());

app.use("/api/user",userRoutes);

app.listen(process.env.PORT, () => {
    console.log(`User service is running on http://localhost:${process.env.PORT}`);
})