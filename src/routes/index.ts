import authRoutes from '../modules/auth/auth.routes';
import dimensionRoutes from '../modules/dimensions/dimension.routes';
import instituteRoutes from '../modules/institute/institute.routes';
import questionRoutes from '../modules/questions/question.routes';
import reportRoutes from '../modules/reports/report.routes';
import responseRoutes from '../modules/responses/response.routes';
import studentRoutes from '../modules/students/student.routes';
import testRoutes from '../modules/tests/test.routes';
import { Router } from 'express';
import inviteRoutes from '../modules/invites/invite.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/institutes', instituteRoutes);
router.use('/tests', testRoutes);
router.use('/dimensions', dimensionRoutes);
router.use('/questions', questionRoutes);
router.use('/students', studentRoutes);
router.use('/responses', responseRoutes);
router.use('/reports', reportRoutes);
router.use('/invites', inviteRoutes);

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

export default router;
