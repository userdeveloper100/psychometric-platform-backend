import { Router } from 'express';
import * as testController from './test.controller';

const router = Router();

/**
 * @route   POST /api/tests
 * @desc    Create a new test (ADMIN only)
 * @access  Private
 */
router.post('/', testController.createTest);

/**
 * @route   GET /api/tests?instituteId=...&page=1&limit=10&status=DRAFT|PUBLISHED&search=...
 * @desc    Get tests for an institute (paginated)
 * @access  Private/Public (based on your middleware setup)
 */
router.get('/', testController.getInstituteTests);

/**
 * @route   PATCH /api/tests/:id/publish
 * @desc    Publish a test (ADMIN only)
 * @access  Private
 */
router.patch('/:id/publish', testController.publishTest);

export default router;
