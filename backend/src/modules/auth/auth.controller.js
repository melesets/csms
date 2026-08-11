// Auth controller - handles login requests and responses
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as authService from './auth.service.js';
import { validateLogin } from './auth.validation.js';
import { signToken } from '../../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { logAudit } from '../admin/admin.service.js';

export const login = asyncHandler(async (req, res) => {
  const validation = validateLogin(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { username, password, profession } = req.body;
  console.log(`[Auth] Attempting login for user: "${username}" (profession: ${profession || 'not provided'})`);

  const user = await authService.findUserByUsername(username);

  if (!user) {
    console.warn(`[Auth] Login failed: Invalid credentials for user "${username}"`);
    await logAudit('login_failed', 'auth', `Failed login attempt for "${username}" — user not found`, username, req.ip);
    return res.status(401).json({ error: 'Invalid username or password. Please check your credentials and select the correct role/profession.' });
  }

  // Support both hashed and plain-text passwords during migration
  let passwordValid = false;
  if (user.password && user.password.startsWith('$2')) {
    passwordValid = await bcrypt.compare(password, user.password);
  } else {
    passwordValid = user.password === password;
  }

  if (!passwordValid) {
    console.warn(`[Auth] Login failed: Invalid credentials for user "${username}"`);
    await logAudit('login_failed', 'auth', `Failed login attempt for "${username}" — wrong password`, username, req.ip);
    return res.status(401).json({ error: 'Invalid username or password. Please check your credentials and select the correct role/profession.' });
  }

  if (!user.isactive) {
    await logAudit('login_blocked', 'auth', `Login blocked for "${username}" — account deactivated`, username, req.ip);
    return res.status(403).json({ error: 'Account is deactivated. Please contact your administrator.' });
  }

  // Validate profession matches the user's account
  // Admin/superadmin can log in with any profession (they manage all professions)
  // For user/staff roles, the selected profession must match the account's profession
  if (profession && !['admin', 'superadmin'].includes(user.role)) {
    if (user.profession && user.profession.toLowerCase() !== profession.toLowerCase()) {
      console.warn(`[Auth] Login failed: Profession mismatch for "${username}" — selected "${profession}", account has "${user.profession}"`);
      await logAudit('login_failed', 'auth', `Failed login attempt for "${username}" — profession mismatch (selected "${profession}", account "${user.profession}")`, username, req.ip);
      return res.status(401).json({ error: `This account is registered as "${user.profession}". Please select the correct profession.` });
    }
  }

  // Validate role-based access to Admin login option
  if (profession === 'Admin' && !['admin', 'superadmin'].includes(user.role)) {
    console.warn(`[Auth] Login failed: Non-admin user "${username}" attempted Admin login`);
    await logAudit('login_failed', 'auth', `Failed login attempt for "${username}" — not an admin account`, username, req.ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  let permissions = user.permissions;
  if (typeof permissions === 'string') {
    try { permissions = JSON.parse(permissions); } catch { permissions = null; }
  }

  if (!permissions || (Array.isArray(permissions) && permissions.length === 0)) {
    permissions = authService.getDefaultPermissions(user.role);
  }

  const tokenPayload = { id: user.id, username: user.username, role: user.role, department: user.department, profession: user.profession };
  const token = signToken(tokenPayload);

  console.log(`[Auth] Login successful: "${username}" (${user.role}, ${user.profession || 'no profession'}, ${user.department || 'no dept'})`);
  await logAudit('login', 'auth', `${user.name || username} logged in (${user.role}, ${user.profession || 'no profession'}, ${user.department || 'no dept'})`, username, req.ip);
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

export const logout = asyncHandler(async (req, res) => {
  const username = req.user?.username || 'unknown';
  await logAudit('logout', 'auth', `${username} logged out`, username, req.ip);
  res.json({ success: true });
});

export const loginPage = (req, res) => {
  res.send('API Login Endpoint is ALIVE. Please use POST method to authenticate.');
};
