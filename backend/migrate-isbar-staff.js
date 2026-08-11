import pg from 'pg';
const { Pool } = pg;

const isbar = new Pool({ user:'postgres', host:'localhost', database:'ISBAR', password:'1954', port:1212 });
const csms  = new Pool({ user:'postgres', host:'localhost', database:'csms', password:'1954', port:1212 });

try {
  // ── 1. Read ISBAR professional accounts (role='user') ──
  const isbarUsers = await isbar.query(
    "SELECT id, name, username, role, department, profession FROM users WHERE role = 'user' ORDER BY id"
  );
  console.log(`ISBAR has ${isbarUsers.rows.length} professional accounts`);

  // ── 2. Read ISBAR department_staff ──
  const isbarStaff = await isbar.query(
    "SELECT id, name, role, department FROM department_staff ORDER BY id"
  );
  console.log(`ISBAR has ${isbarStaff.rows.length} department staff`);

  // ── 3. Read existing CSMS users to avoid duplicates ──
  const existingUsers = await csms.query("SELECT username FROM users");
  const existingUsernames = new Set(existingUsers.rows.map(r => r.username));
  console.log(`CSMS already has ${existingUsernames.size} users`);

  // ── 4. Create professional accounts in CSMS ──
  let createdUsers = 0;
  let skippedUsers = 0;
  const userIdMap = new Map(); // isbar_user_id -> csms_user_id

  for (const u of isbarUsers.rows) {
    if (existingUsernames.has(u.username)) {
      // Already exists — get the CSMS id
      const existing = await csms.query("SELECT id FROM users WHERE username = $1", [u.username]);
      if (existing.rows.length > 0) {
        userIdMap.set(u.id, existing.rows[0].id);
      }
      skippedUsers++;
      console.log(`  SKIP (exists): ${u.username} (${u.name})`);
      continue;
    }

    const email = u.username + '@csms.local';
    const result = await csms.query(
      `INSERT INTO users (name, username, email, role, department, profession, password, isactive, created_at)
       VALUES ($1, $2, $3, 'user', $4, $5, 'userpass', true, NOW())
       RETURNING id`,
      [u.name, u.username, email, u.department, u.profession]
    );
    userIdMap.set(u.id, result.rows[0].id);
    createdUsers++;
    console.log(`  CREATED: ${u.username} (${u.name}) -> dept=${u.department}, prof=${u.profession}`);
  }

  console.log(`\nProfessional accounts: ${createdUsers} created, ${skippedUsers} skipped`);

  // ── 5. Map department_staff to professional accounts ──
  // Group CSMS professional accounts by department
  const csmsProUsers = await csms.query(
    "SELECT id, department, profession FROM users WHERE role = 'user'"
  );
  const deptAccounts = new Map(); // department -> [{ id, profession }]
  for (const u of csmsProUsers.rows) {
    const dept = u.department;
    if (!deptAccounts.has(dept)) deptAccounts.set(dept, []);
    deptAccounts.get(dept).push({ id: u.id, profession: u.profession });
  }

  // Profession mapping: staff role -> professional account profession
  const professionMap = {
    'Nurse': 'Nurse',
    'Head Nurse': 'Nurse',
    'Midwife': 'Midwifery',
    'Head Midwife': 'Midwifery',
    'Shift Focal': null, // match first account in department
    'Department Head': null,
    'GP': 'General Practitioner',
    'Senior': 'Senior Physician',
  };

  function findParentUserId(department, staffRole) {
    const accounts = deptAccounts.get(department);
    if (!accounts || accounts.length === 0) return null;

    const targetProf = professionMap[staffRole];

    // Try exact profession match
    if (targetProf) {
      const match = accounts.find(a => a.profession === targetProf);
      if (match) return match.id;
    }

    // Fallback: assign to first account in department (usually Nurse)
    return accounts[0].id;
  }

  // ── 6. Read existing CSMS staff to avoid duplicates ──
  const existingStaff = await csms.query("SELECT name, department FROM users WHERE role = 'staff'");
  const existingStaffSet = new Set(existingStaff.rows.map(r => `${r.name.trim().toLowerCase()}|${r.department.trim().toLowerCase()}`));

  // ── 7. Create staff in CSMS ──
  let createdStaff = 0;
  let skippedStaff = 0;

  for (const s of isbarStaff.rows) {
    const key = `${s.name.trim().toLowerCase()}|${s.department.trim().toLowerCase()}`;
    if (existingStaffSet.has(key)) {
      skippedStaff++;
      console.log(`  SKIP (exists): ${s.name} (${s.department})`);
      continue;
    }

    const parentId = findParentUserId(s.department, s.role);
    const tempUsername = s.name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 10000);
    const tempEmail = tempUsername + '@csms.local';

    await csms.query(
      `INSERT INTO users (name, username, email, role, department, profession, password, isactive, parent_user_id, created_at)
       VALUES ($1, $2, $3, 'staff', $4, $5, 'staffpass', true, $6, NOW())`,
      [s.name.trim(), tempUsername, tempEmail, s.department, s.role, parentId]
    );
    createdStaff++;
    console.log(`  CREATED staff: ${s.name} (${s.role}) -> dept=${s.department}, parent=${parentId}`);
  }

  console.log(`\nStaff: ${createdStaff} created, ${skippedStaff} skipped`);
  console.log('\n=== MIGRATION COMPLETE ===');

  await isbar.end();
  await csms.end();
} catch(e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  await isbar.end();
  await csms.end();
  process.exit(1);
}
