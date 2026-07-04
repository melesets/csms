// Departments service - queries distinct departments across tables
import pool from '../../config/database.js';

export async function findDistinctDepartments() {
  const result = await pool.query(`
    SELECT DISTINCT department FROM (
      SELECT department FROM users
      UNION
      SELECT department FROM resources
      UNION
      SELECT department FROM department_staff
      UNION
      SELECT department FROM form_templates
      UNION
      SELECT department FROM dashboard_mappings
    ) t
    WHERE department IS NOT NULL AND department <> ''
    ORDER BY department
  `);
  return result.rows.map(r => r.department);
}
