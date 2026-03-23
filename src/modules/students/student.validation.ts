import { body } from "express-validator";

export const createStudentValidation = [
    body("name")
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ min: 2 })
        .withMessage("Name must be at least 2 characters"),

    body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email"),

    body("instituteId")
        .notEmpty()
        .withMessage("Institute ID is required")
        .isUUID()
        .withMessage("Invalid instituteId format"),
];