import { Router } from 'express';
import * as instituteController from './institute.controller';

const router = Router();

// Create
router.post('/', instituteController.createInstitute);

// Read
router.get('/', instituteController.getInstitutes);
router.get('/:id', instituteController.getInstituteById);

// Update
router.put('/:id', instituteController.updateInstitute);

// Soft delete
router.delete('/:id', instituteController.deleteInstitute);

export default router;
