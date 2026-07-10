// Staff service - CRUD for department staff with profile photo upload
import pool from '../../config/database.js';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../../uploads/profiles');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const AVATAR_SIZE = 200;

const storage = multer.memoryStorage();
export const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

export async function processAndSave(buffer, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  const filename = `staff-${Date.now()}.webp`;
  const filepath = path.join(uploadDir, filename);
  await sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(filepath);
  return `/uploads/profiles/${filename}`;
}

export async function findAllStaff() {
  let result;
  try {
    result = await pool.query(`
      SELECT u.id, u.name, u.username, u.profession AS role, u.department, u.profile_picture,
             u.created_by AS "createdBy",
             ss.shift_name AS "currentShift", ss.start_time AS "shiftStartTime", ss.is_active AS "isOnDuty"
      FROM users u
      LEFT JOIN shift_sessions ss ON u.id = ss.user_id AND ss.is_active = true
      WHERE u.role = 'staff'
      ORDER BY u.created_at DESC NULLS LAST
    `);
  } catch (joinErr) {
    result = await pool.query(`
      SELECT u.id, u.name, u.username, u.profession AS role, u.department, u.profile_picture,
             u.created_by AS "createdBy"
      FROM users u WHERE u.role = 'staff' ORDER BY u.created_at DESC NULLS LAST
    `);
  }
  return result.rows;
}

export async function createStaff(data) {
  const { name, role, department, createdBy } = data;
  const tempUsername = name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 10000);
  const tempEmail = tempUsername + '@isbar.local';
  const profilePicture = data.profilePicture || null;

  const result = await pool.query(
    'INSERT INTO users (name, profession, department, role, username, email, password, isactive, created_by, created_at, profile_picture) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, NOW(), $9) RETURNING id, name, profession AS role, department, created_by AS "createdBy", profile_picture',
    [name, role, department, 'staff', tempUsername, tempEmail, 'staffpass', createdBy ?? null, profilePicture]
  );
  return result.rows[0];
}

export async function updateStaff(id, data) {
  const { name, role, department, profilePicture } = data;
  let query, params;
  if (profilePicture) {
    query = 'UPDATE users SET name = $1, profession = $2, department = $3, profile_picture = $4 WHERE id = $5 AND role = $6 RETURNING id, name, profession AS role, department, created_by AS "createdBy", profile_picture';
    params = [name, role, department, profilePicture, id, 'staff'];
  } else {
    query = 'UPDATE users SET name = $1, profession = $2, department = $3 WHERE id = $4 AND role = $5 RETURNING id, name, profession AS role, department, created_by AS "createdBy", profile_picture';
    params = [name, role, department, id, 'staff'];
  }
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function deleteStaff(id) {
  const result = await pool.query('DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id', [id, 'staff']);
  return result.rows.length > 0;
}
