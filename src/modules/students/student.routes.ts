import { Router } from 'express';
import * as studentController from './student.controller';

const router = Router();

router.post('/', studentController.createStudent);
router.post('/bulk-upload', studentController.bulkUploadStudents);

export default router;
