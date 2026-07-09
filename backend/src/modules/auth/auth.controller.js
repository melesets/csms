// Auth controller - handles login requests and responses
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as authService from './auth.service.js';
import { validateLogin } from './auth.validation.js';
import { signToken } from '../../middleware/auth.js';
import bcrypt from 'bcryptjs';

export const login = asyncHandler(async (req, res) => {
  const validation = validateLogin(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { username, password } = req.body;
  console.log(`[Auth] Attempting login for user: "${username}"`);

  const user = await authService.findUserByUsername(username);

  if (!user) {
    console.warn(`[Auth] Login failed: Invalid credentials for user "${username}"`);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Support both hashed and plain-text passwords during migration
  let passwordValid = false;
  if (user.password && user.password.startsWith('$2')) {
    // Hashed password — verify with bcrypt
    passwordValid = await bcrypt.compare(password, user.password);
  } else {
    // Plain-text fallback (legacy) — compare directly
    passwordValid = user.password === password;
  }

  if (!passwordValid) {
    console.warn(`[Auth] Login failed: Invalid credentials for user "${username}"`);
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (!user.isactive) {
    return res.status(403).json({ error: 'Account is deactivated' });
  }

  let permissions = user.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = null; }
  }

  if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) {
    permissions = authService.getDefaultPermissions(user.role);
  }

  const tokenPayload = { id: user.id, username: user.username, role: user.role, department: user.department };
  const token = signToken(tokenPayload);

  console.log(`[Auth] Login successful: "${username}"`);
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    profession: user.profession,
    isactive: user.isactive,
    permissions,
    created_by: user.created_by,
    token,
  });
});

export const loginPage = (req, res) => {
  res.send('API Login Endpoint is ALIVE. Please use POST method to authenticate.');
};
