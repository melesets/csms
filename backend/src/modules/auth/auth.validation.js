// Login request validation rules
export function validateLogin(body) {
  const { username, password } = body;
  if (!username || !password) {
    return { valid: false, error: 'Username and password are required' };
  }
  return { valid: true };
}
