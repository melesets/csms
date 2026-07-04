// Auth route definitions - POST /login
import { Router } from 'express';
import * as authController from './auth.controller.js';

const router = Router();

router.get('/login', authController.loginPage);
router.post('/login', authController.login);

export default router;
