import { Request, Response } from 'express';
import * as studentService from './student.service';

export const createStudent = async (req: Request, res: Response) => {
    try {
        const student = await studentService.createStudent(req.body);
        res.status(201).json(student);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};

export const bulkUploadStudents = async (req: Request, res: Response) => {
    try {
        const students = await studentService.bulkUploadStudents(req.body.students);
        res.status(201).json(students);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
};
