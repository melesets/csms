// Auth route definitions - POST /login
import { Router } from 'express';
import * as authController from './auth.controller.js';
import { loginLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.get('/login', authController.loginPage);
router.post('/login', loginLimiter, authController.login);

export default router;
