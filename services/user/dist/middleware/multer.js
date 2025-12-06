import multer from "multer";
const storage = multer.memoryStorage();
const uploader = multer({ storage }).any();
const uploadFile = (req, res, next) => {
    uploader(req, res, (error) => {
        if (error) {
            return next(error);
        }
        const files = req.files;
        if (files && files.length) {
            req.file = files[0];
        }
        return next();
    });
};
export default uploadFile;
