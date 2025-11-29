import axios from "axios";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import { TryCatch } from "../utils/TryCatch.js";
import bcrypt from 'bcrypt'


export const registerUser = TryCatch(async (req, res, next) => {
    const { name, email, password, phoneNumber, role, bio } = req.body;

    if (!name || !email || !password || !phoneNumber || !role) {
        throw new ErrorHandler(400, "Please fill all derails ");
    }

    const existingUsers = await sql`SELECT user_id FROM users WHERE email = ${email}`;

    if (existingUsers.length > 0) {
        throw new ErrorHandler(409, " User with this email already exists")
    }

    const hashPassword = await bcrypt.hash(password, 10);

    let registeredUser;

    if (role === "recruiter ") {
        const [user] = await sql`INSERT INTO users (name, email, password, phone_number, role) VALUES
                                 (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}) RETURNING
                                 user_id, name, email, phone_number, role, created_at`;

        registeredUser = user;
    } else if (role === "jobseeker") {
        const file = req.file

        if(!file){
            throw new ErrorHandler(400, "Resume file is required for jobseekers ")
        }

        const fileBuffer = getBuffer(file);

        if (!fileBuffer || !fileBuffer.content){
            throw new ErrorHandler(500, "Failed to generate buffer")
        }

        if (!process.env.UPLOAD_SERVICE) {
            throw new ErrorHandler(500, "UPLOAD_SERVICE environment variable is not configured")
        }

        // Ensure UPLOAD_SERVICE uses http:// not https:// for local development
        const uploadServiceUrl = process.env.UPLOAD_SERVICE.replace(/^https:\/\//, 'http://');

        let data;
        try {
            const response = await axios.post(
                `${uploadServiceUrl}/api/utils/upload`,
                {buffer: fileBuffer.content},
                {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            data = response.data;
        } catch (error: any) {
            if (error.code === 'EPROTO' || error.message?.includes('wrong version number')) {
                throw new ErrorHandler(500, `SSL Error: UPLOAD_SERVICE must use http:// not https://. Current value: ${process.env.UPLOAD_SERVICE}`)
            }
            if (error.code === 'ECONNREFUSED') {
                throw new ErrorHandler(500, `Connection refused: Cannot connect to upload service at ${uploadServiceUrl}. Make sure the utils service is running.`)
            }
            if (error.response) {
                throw new ErrorHandler(error.response.status || 500, `Upload service error: ${error.response.data?.message || error.message}`)
            }
            throw new ErrorHandler(500, `Failed to upload file: ${error.message}`)
        }
        const [user] = await sql`INSERT INTO users (name, email, password, phone_number, role, bio, resume, resume_public_id ) VALUES
                                 (${name}, ${email}, ${hashPassword}, ${phoneNumber}, ${role}, ${bio}, ${data.url}, ${data.public_id}) RETURNING
                                 user_id, name, email, phone_number, role, bio, resume, created_at`;

                                 registeredUser = user;


    }
    res.json({
        message:"user Registerd ",
        registeredUser,
    });
}) 