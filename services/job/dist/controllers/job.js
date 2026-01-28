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
export const createJob = TryCatch(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ErrorHandler(401, "Authentication required");
    }
    if (user.role !== "recruiter") {
        throw new ErrorHandler(403, "Only recruiters can create companies");
    }
    const { title, description, location, salary, company_id, role, job_type, work_location, openings } = req.body;
    if (!title || !description || !location || !salary || !role || !openings) {
        throw new ErrorHandler(400, "All fields are required");
    }
    const [company] = await sql `SELECT company_id FROM companies WHERE company_id = ${company_id}
        AND recruiter_id = ${user.user_id}`;
    if (!company) {
        throw new ErrorHandler(404, "Company not found");
    }
    const [newJob] = await sql `INSERT INTO jobs (title, description, location, salary, company_id, role, job_type, work_location, posted_by_recruiter_id,openings), (${title}, ${description}, ${location}, ${salary}, ${company_id}, ${role}, ${job_type}, ${work_location}, ${user.user_id}, ${openings} RETURNING *)`;
    res.json({
        message: "Job created successfully",
        job: newJob,
    });
});
export const updatedJob = TryCatch(async (req, res) => {
    const user = req.user;
    if (!user) {
        throw new ErrorHandler(401, "Authentication required");
    }
    if (user.role !== "recruiter") {
        throw new ErrorHandler(403, "Only recruiters can create companies");
    }
    const { title, description, location, salary, company_id, role, job_type, work_location, openings, is_active } = req.body;
    const [existingJob] = await sql `SELECT posted_by_recruiter_id FROM jobs WHERE job_id = ${req.params.jobId}`;
    if (!existingJob) {
        throw new ErrorHandler(404, "Job not found");
    }
    if (existingJob.posted_by_recruiter_id !== user.user_id) {
        throw new ErrorHandler(403, "Forbiden: you are not allowed to update this job");
    }
    const [updatedJob] = await sql `UPDATE jobs SET title = ${title}, description = ${description}, location = ${location}, salary = ${salary}, company_id = ${company_id}, role = ${role}, job_type = ${job_type}, work_location = ${work_location}, posted_by_recruiter_id = ${user.user_id}, openings = ${openings}, is_active = ${is_active} WHERE job_id = ${req.params.jobId} RETURNING *`;
    res.json({
        message: "Job updated successfully",
        job: updatedJob,
    });
});
export const getAllCompany = TryCatch(async (req, res) => {
    const companies = await sql `SELECT * FROM companies WHERE recruiter_id = ${req.user?.user_id}`;
    res.json(companies);
});
export const getCompanyDetails = TryCatch(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new ErrorHandler(400, "Company id is required");
    }
    const [companyData] = await sql `SELECT c.*, COALESCE (
    (
    SELECT json_agg(j.*) FROM json j WHERE j.company_id = c.company_id),
    '[]'::json
) AS jobs FROM companies c WHERE c.company_id = ${id} GROUP BY c.company_id;`;
    if (!companyData) {
        throw new ErrorHandler(404, "Company not found");
    }
    res.json(companyData);
});
export const getAllActiveJobs = TryCatch(async (req, res) => {
    const { title, location } = req.query;
    let queryString = `SELECT j.job_id, j.title, j.description, j.location, j.salary, j.role, j.job_type, j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id AS company_id FROM jobs j JOIN company c ON j.company_id = c.company_id WHERE j.is_active = true`;
    const values = [];
    let paramIndex = 1;
    if (title) {
        queryString += ` AND j.title ILIKE $${paramIndex}`;
        values.push(`%${title}%`);
        paramIndex++;
    }
    if (location) {
        queryString += `AND j.location ILIKE $${paramIndex}`;
        values.push(`%${location}%`);
        paramIndex++;
    }
    queryString += " ORDER BY j.created_at DESC";
    const jobs = (await sql.query(queryString, values));
    res.json(jobs);
});
export const getSingleJob = TryCatch(async (req, res) => {
    const [job] = await sql `SELECT * FROM jobs WHERE job_id = ${req.params.jobId}`;
    res.json(job);
});
