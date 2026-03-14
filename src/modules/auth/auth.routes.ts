import { Router } from 'express';
import * as authController from './auth.controller';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new institute admin
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT token
 * @access  Public
 */
router.post('/login', authController.login);

export default router;
