// User request validation - create and PIN rules
export function validateCreateUser(body) {
  const { username, password, name, role, department } = body;
  if (!username || !password || !name || !role || !department) {
    return { valid: false, error: 'Missing required fields' };
  }
  return { valid: true };
}

export function validateSetPin(body) {
  const { pin } = body;
  if (!pin || String(pin).length !== 4) {
    return { valid: false, error: 'PIN must be exactly 4 digits' };
  }
  return { valid: true };
}
