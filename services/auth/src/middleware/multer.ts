import type { NextFunction, Request, Response } from "express";
import multer from "multer";

const storage = multer.memoryStorage();

const uploader = multer({ storage }).any();

const uploadFile = (req: Request, res: Response, next: NextFunction) => {
    uploader(req, res, (error: unknown) => {
        if (error) {
            return next(error);
        }

        const files = req.files as Express.Multer.File[] | undefined;
        if (files && files.length) {
            req.file = files[0];
        }

        return next();
    });
};

export default uploadFile;
