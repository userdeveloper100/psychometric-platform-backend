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

    // instituteId is not validated here. The tenant comes only from the verified JWT (req.user), so a body value
    // would be ignored anyway. Requiring it made a student impossible to create without a value the server never uses.
];