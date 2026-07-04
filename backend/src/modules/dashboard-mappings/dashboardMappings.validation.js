export function validateCreateMapping(body) {
  const { formTemplateId, formTemplateName, department, departments, dashboardType, displayName } = body;
  if (!formTemplateId || !formTemplateName || (!department && !(Array.isArray(departments) && departments.length > 0)) || !dashboardType || !displayName) {
    return { valid: false, error: 'Missing required fields' };
  }
  if (!['patient', 'resource'].includes(dashboardType)) {
    return { valid: false, error: 'Invalid dashboard type' };
  }
  return { valid: true };
}

export function validateDashboardType(type) {
  if (type && !['patient', 'resource'].includes(type)) {
    return { valid: false, error: 'Invalid dashboard type' };
  }
  return { valid: true };
}
