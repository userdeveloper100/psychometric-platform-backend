import { Router } from 'express';
import UserController from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
const userController = new UserController();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/profile', authenticate, userController.getProfile);

export default router;