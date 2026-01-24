import { TryCatch } from "../utils/TryCatch.js";
import ErrorHandler from "../utils/ErrorHandler.js";
import { sql } from "../utils/db.js";
import getBuffer from "../utils/buffer.js";
import axios from "axios";
// import { buffer } from "stream/consumers";
export const createCompany = TryCatch(async (req, res, next) => {
    const user = req.user;
    if (!user) {
        throw new ErrorHandler(401, "Authentication required");
    }
    if (user.role !== "recruiter") {
        throw new ErrorHandler(403, "Only recruiters can create companies");
    }
    const { name, description, website } = req.body;
    if (!name || !description || !website) {
        throw new ErrorHandler(400, "All fields are required");
    }
    const existingCompany = await sql `SELECT company_id FROM companies WHERE name = ${name}`;
    if (existingCompany.length > 0) {
        throw new ErrorHandler(409, `A Company with the name ${name} already exists`);
    }
    const file = req.file;
    if (!file) {
        throw new ErrorHandler(400, "Company Logo file is required");
    }
    const fileBuffer = getBuffer(file);
    if (!fileBuffer || !fileBuffer.content) {
        throw new ErrorHandler(500, "Failed to create file buffer");
    }
    const { data } = await axios.post(`${process.env.UPLOAD_SERVICE}/api/utils/upload`, { buffer: fileBuffer.content });
    const [newCompany] = await sql `INSERT INTO companies (name, description, website, logo, logo_public_id, recruiter_id) VALUES (${name}, ${description}, ${website}, ${data.url}, ${data.public_id}, ${req.user?.user_id}) RETURNING * `;
    res.json({
        message: "Company created successfully",
        company: newCompany,
    });
});
export const deleteCompany = TryCatch(async (req, res) => {
    const user = req.user;
    const { companyId } = req.params;
    const [company] = await sql `SELECT logo_public_id FROM companies WHERE company_id = ${companyId} AND recruiter_id = ${user?.user_id}`;
    if (!company) {
        throw new ErrorHandler(404, "Company not found");
    }
    await sql `DELETE FROM companies WHERE company_id = ${companyId}`;
    res.json({
        message: "Company and all associated jobs have been deleted successfully"
    });
});
