import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";
import bcrypt from 'bcrypt';
export const registerUser = TryCatch(async (req, res, next) => {
    const { name, email, password, phonenumber, role, bio } = req.body;
    if (!name || !email || !password || !phonenumber || !role) {
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
                                 (${name}, ${email} ${hashPassword}, ${phonenumber}, ${role}) RETURNING
                                 user_id, name, email, phone_number, role, created_at`;
        registeredUser = user;
    }
    else if (role === "jobseeker") {
        const file = req.file;
        const [user] = await sql `INSERT INTO users (name, email, password, phone_number, role) VALUES
                                 (${name}, ${email} ${hashPassword}, ${phonenumber}, ${role}) RETURNING
                                 user_id, name, email, phone_number, role, created_at`;
    }
    res.json(email);
});
