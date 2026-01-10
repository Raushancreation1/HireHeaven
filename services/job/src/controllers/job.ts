import { TryCatch } from "../utils/TryCatch.js";

import type { AuthenticatedRequest } from "../middleware/auth.js";
import type { Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler.js";
import { sql } from "../utils/db.js";
import getBuffer from "../utils/buffer.js";
import axios from "axios";

export const createCompany = TryCatch(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if(!user){
        throw new ErrorHandler(401, "Authentication required")
    }

    if(user.role !== "recruiter"){
        throw new ErrorHandler(403, "Only recruiters can create companies");
    }

    const {name, description, website} = req.body;

    if (!name || !description || !website) {
        throw new ErrorHandler(400, "All fields are required");
    }

    const existingCompany = await sql `SELECT company_id WHERE name = ${name}`;
    
    if (existingCompany.length > 0) {
        throw new ErrorHandler(409, `A Company with the name ${name} already exists`);
    }

    const file = req.file

    if (!file){
        throw new ErrorHandler(400, "Company Logo file is required");
    }

    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content){
        throw new ErrorHandler(500, "Failed to create file buffer");
    }

    const {data} = await axios.post(`${process.env.UPLOAD_SERVICE}`)
});
