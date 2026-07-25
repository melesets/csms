// User routes - /users CRUD and /users/:id/set-pin
import { Router } from 'express';
import * as usersController from './users.controller.js';

const router = Router();

router.get('/users', usersController.getUsers);
router.get('/users/:parentUserId/staff', usersController.getStaffByParent);
router.post('/users', usersController.createUser);
router.put('/users/:id', usersController.updateUser);
router.delete('/users/:id', usersController.deleteUser);
router.post('/users/verify-password', usersController.verifyPassword);
router.post('/users/reset-staff-pin', usersController.resetStaffPin);
router.put('/users/:id/set-pin', usersController.setPin);

export default router;
