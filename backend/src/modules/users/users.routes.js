// User routes - /users CRUD and /users/:id/set-pin
import { Router } from 'express';
import * as usersController from './users.controller.js';
import { requireRoleLevel } from '../../middleware/auth.js';

const router = Router();

router.get('/users', usersController.getUsers);
router.get('/users/:parentUserId/staff', usersController.getStaffByParent);
router.post('/users', requireRoleLevel('admin'), usersController.createUser);
router.put('/users/:id', requireRoleLevel('admin'), usersController.updateUser);
router.delete('/users/:id', requireRoleLevel('admin'), usersController.deleteUser);
router.post('/users/verify-password', usersController.verifyPassword);
router.post('/users/reset-staff-pin', requireRoleLevel('admin'), usersController.resetStaffPin);
router.put('/users/:id/set-pin', requireRoleLevel('admin'), usersController.setPin);

export default router;
