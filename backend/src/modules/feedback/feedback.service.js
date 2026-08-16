import pool from '../../config/database.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '../../../uploads/feedback');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.pdf',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext) || (file.mimetype && file.mimetype.startsWith('image/'))) cb(null, true);
    else cb(new Error('Unsupported file type â€” allowed: images, PDF, Word, Excel, PowerPoint, TXT, CSV'));
  },
});

const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'closed'];
const VALID_CATEGORIES = [
  'patient_care', 'staffing', 'equipment', 'medication', 'facility',
  'safety', 'communication', 'information', 'other',
];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

export const isAdminUser = (user) => user?.role === 'admin' || user?.role === 'superadmin';

export async function saveAttachment(file) {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
  const filename = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filepath, file.buffer);
  const { rows } = await pool.query(
    `INSERT INTO feedback_attachments (original_name, mime_type, size_bytes, storage_path)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [file.originalname, file.mimetype || 'application/octet-stream', file.size, `/uploads/feedback/${filename}`]
  );
  return normalizeAttachment(rows[0]);
}

export function getAttachmentRow(id) {
  return pool.query(`SELECT * FROM feedback_attachments WHERE id = $1`, [id]).then(r => r.rows[0] || null);
}

const normalizeAttachment = (row) => ({
  id: row.id,
  feedbackId: row.feedback_id,
  originalName: row.original_name,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  path: row.storage_path,
  createdAt: row.created_at,
});

const normalize = (row) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userRole: row.user_role,
  department: row.department,
  targetDepartment: row.target_department,
  targetProfession: row.target_profession,
  targetRole: row.target_role,
  targetUserId: row.target_user_id,
  targetUserName: row.target_user_name,
  category: row.category,
  subject: row.subject,
  message: row.message,
  rating: row.rating,
  status: row.status,
  priority: row.priority,
  isRead: row.is_read,
  giverSeenAt: row.giver_seen_at,
  replyCount: row.reply_count ?? 0,
  lastReplyAt: row.last_reply_at ?? null,
  hasNewReply: row.has_new_reply ?? (row.giver_seen_at === null && row.reply_count > 0),
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Professions are the primary receivers. A few stored variants map to the
// canonical app professions so targeting works for every staff member.
const PROFESSION_ALIASES = {
  'Midwifery': ['Midwifery', 'Midwife'],
  'General Practitioner': ['General Practitioner', 'GP'],
};
const professionsFor = (user) => (user?.profession && PROFESSION_ALIASES[user.profession]) || [user?.profession].filter(Boolean);

// Visibility: admins oversee everything; staff see their own, general untargeted
// feedback, and feedback addressed to them — by role, by profession (hospital-wide
// or narrowed to their unit), or directly to the specific user.
function visibilityWhere(user, params, alias = 'f') {
  if (isAdminUser(user)) return '';
  const p = alias ? `${alias}.` : '';
  const isParam = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  const profs = professionsFor(user);
  return `(${p}user_id = ${isParam(user.id)}
    OR (${p}target_user_id = ${isParam(user.id)})
    OR (${p}target_department IS NULL AND ${p}target_profession IS NULL AND ${p}target_role IS NULL AND ${p}target_user_id IS NULL)
    OR (${p}target_profession = ANY(${isParam(profs)}::text[]) AND (${p}target_department IS NULL OR ${p}target_department = ${isParam(user.department)}))
    OR (${p}target_role = ${isParam(user.role)}))`;
}

// Mark which rows are unread for a staff viewer (no view record yet)
async function decorateForStaff(rows, userId) {
  const ids = rows.map(r => r.id);
  if (!ids.length) return rows;
  const { rows: views } = await pool.query(
    `SELECT DISTINCT feedback_id FROM feedback_views WHERE user_id = $1 AND feedback_id = ANY($2::int[])`,
    [userId, ids]
  );
  const seen = new Set(views.map(v => v.feedback_id));
  return rows.map(r => ({
    ...r,
    // Creator: badge when the department replied and they haven't seen it yet.
    // Receiver: badge when the thread is unseen by them.
    has_new_reply: r.user_id === userId
      ? (r.giver_seen_at === null && r.reply_count > 0)
      : !seen.has(r.id),
  }));
}

const normalizeReply = (row, original) => {
  let replyTo = null;
  if (row.reply_to_id) {
    if (row.reply_to_id === 0 && original) {
      replyTo = { id: 0, senderName: original.user_name, snippet: (original.message || '').slice(0, 80) };
    } else if (row.reply_to_id > 0) {
      replyTo = { id: row.reply_to_id, senderName: row.reply_to_name || 'Reply', snippet: (row.reply_to_message || '').slice(0, 80) };
    }
  }
  return {
    id: row.id,
    feedbackId: row.feedback_id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    message: row.message,
    replyToId: row.reply_to_id || 0,
    replyTo,
    seenAt: row.seen_at,
    createdAt: row.created_at,
    attachments: row.attachments || [],
  };
};

const FEEDBACK_SELECT = `
  SELECT f.*, tu.name AS target_user_name,
    (SELECT COUNT(*)::int FROM feedback_replies r WHERE r.feedback_id = f.id) AS reply_count,
    (SELECT MAX(r.created_at) FROM feedback_replies r WHERE r.feedback_id = f.id) AS last_reply_at,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', a.id, 'feedbackId', a.feedback_id, 'originalName', a.original_name,
        'mimeType', a.mime_type, 'sizeBytes', a.size_bytes, 'path', a.storage_path,
        'createdAt', a.created_at
      ) ORDER BY a.id)
      FROM feedback_attachments a WHERE a.feedback_id = f.id
    ), '[]') AS attachments
  FROM feedback f
  LEFT JOIN users tu ON tu.id = f.target_user_id`;

export async function findFeedback({ user, status, category, department, priority, search, userId, limit = 100, offset = 0 }) {
  const isAdmin = isAdminUser(user);
  const params = [];
  const where = [];
  const isParam = (v) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (!isAdmin) {
    where.push(visibilityWhere(user, params));
  } else {
    if (status && VALID_STATUSES.includes(status)) where.push(`f.status = ${isParam(status)}`);
    if (category && VALID_CATEGORIES.includes(category)) where.push(`f.category = ${isParam(category)}`);
    if (priority && VALID_PRIORITIES.includes(priority)) where.push(`f.priority = ${isParam(priority)}`);
    if (department) where.push(`f.target_department = ${isParam(department)}`);
    if (userId) where.push(`f.user_id = ${isParam(userId)}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(f.subject ILIKE $${params.length} OR f.message ILIKE $${params.length} OR f.user_name ILIKE $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${FEEDBACK_SELECT} ${whereSql} ORDER BY f.created_at DESC LIMIT ${isParam(limit)} OFFSET ${isParam(offset)}`,
    params
  );
  return (isAdmin ? rows : await decorateForStaff(rows, user.id)).map(normalize);
}

export async function countFeedback({ user, status, category, department, search }) {
  const isAdmin = isAdminUser(user);
  const params = [];
  const where = [];
  const isParam = (v) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (!isAdmin) where.push(visibilityWhere(user, params, ''));
  else {
    if (status && VALID_STATUSES.includes(status)) where.push(`status = ${isParam(status)}`);
    if (category && VALID_CATEGORIES.includes(category)) where.push(`category = ${isParam(category)}`);
    if (department) where.push(`target_department = ${isParam(department)}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(subject ILIKE $${params.length} OR message ILIKE $${params.length} OR user_name ILIKE $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM feedback ${whereSql}`, params);
  return rows[0].total;
}

export async function createFeedback({ user, body }) {
  const { category = 'other', subject, message, rating = null, attachmentIds = [], targetDepartment = null, targetProfession = null, targetRole = null, targetUserId = null } = body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const isAdmin = isAdminUser(user);
    const { rows } = await client.query(
      `INSERT INTO feedback (user_id, user_name, user_role, department, category, subject, message, rating, giver_seen_at, target_department, target_profession, target_role, target_user_id, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13)
       RETURNING *`,
      [user.id, user.name || user.username, user.role, user.department || null, category, subject, message, rating, targetDepartment || null, targetProfession || null, targetRole || null, targetUserId || null, isAdmin]
    );
    const ids = (Array.isArray(attachmentIds) ? attachmentIds : []).map(Number).filter(Boolean);
    if (ids.length) {
      await client.query(
        `UPDATE feedback_attachments SET feedback_id = $1 WHERE id = ANY($2::int[]) AND feedback_id IS NULL`,
        [rows[0].id, ids]
      );
    }
    await client.query('COMMIT');
    const item = normalize(rows[0]);
    item.attachments = ids.length
      ? (await pool.query(`SELECT * FROM feedback_attachments WHERE id = ANY($1::int[])`, [ids])).rows.map(normalizeAttachment)
      : [];
    return item;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getFeedbackStats(user) {
  const isAdmin = isAdminUser(user);
  const params = [];
  const scope = isAdmin ? '' : `WHERE ${visibilityWhere(user, params, '')}`;

  const byStatus = {};
  const statusRes = await pool.query(`SELECT status, COUNT(*)::int AS count FROM feedback ${scope} GROUP BY status`, params);
  statusRes.rows.forEach(r => { byStatus[r.status] = r.count; });

  const byCategory = {};
  const catRes = await pool.query(`SELECT category, COUNT(*)::int AS count FROM feedback ${scope} GROUP BY category`, params);
  catRes.rows.forEach(r => { byCategory[r.category] = r.count; });

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS avg_rating FROM feedback ${scope}`, params);

  const unreadRes = isAdmin
    ? await pool.query(`SELECT COUNT(*)::int AS count FROM feedback WHERE is_read = FALSE`)
    : await (() => {
        if (!user.department && !user.profession && !user.role) return Promise.resolve({ rows: [{ count: 0 }] });
        const profs = professionsFor(user);
        return pool.query(
          `SELECT COUNT(*)::int AS count FROM feedback
           WHERE (user_id != $1
              AND (target_user_id = $1
                OR (target_profession = ANY($2::text[]) AND (target_department IS NULL OR target_department = $3))
                OR target_role = $4
                OR (target_department IS NULL AND target_profession IS NULL AND target_role IS NULL AND target_user_id IS NULL))
              AND NOT EXISTS (SELECT 1 FROM feedback_views v WHERE v.feedback_id = feedback.id AND v.user_id = $1))
              OR (user_id = $1 AND giver_seen_at IS NULL AND EXISTS (SELECT 1 FROM feedback_replies r WHERE r.feedback_id = feedback.id))`,
          [user.id, profs.length ? profs : [''], user.department, user.role]
        );
      })();

  return {
    total: totalRes.rows[0].total,
    avgRating: Math.round(totalRes.rows[0].avg_rating * 10) / 10,
    unread: unreadRes.rows[0].count,
    byStatus,
    byCategory,
  };
}

export async function updateFeedback(id, { status, priority, isRead, actingUser }) {
  const { rows: fb } = await pool.query(`SELECT * FROM feedback WHERE id = $1`, [id]);
  if (!fb.length) return null;
  const target = fb[0];
  const isAdmin = isAdminUser(actingUser);

  if (!isAdmin) {
    // Receiving staff may only move the status forward (in progress / resolved)
    if (!canAccessFeedback(actingUser, target)) return { error: 'forbidden' };
    if (status !== 'in_progress' && status !== 'resolved') return { error: 'invalid_status' };
    if (priority || typeof isRead === 'boolean') return { error: 'forbidden' };
  }

  const sets = [];
  const params = [];
  if (status && VALID_STATUSES.includes(status)) {
    params.push(status);
    sets.push(`status = $${params.length}`);
  }
  if (priority && VALID_PRIORITIES.includes(priority)) {
    params.push(priority);
    sets.push(`priority = $${params.length}`);
  }
  if (typeof isRead === 'boolean') {
    params.push(isRead);
    sets.push(`is_read = $${params.length}`);
  }
  if (!sets.length) return null;

  if (isAdmin && (status || priority)) {
    // Admin actioned it — notify the giver and the receiving staff
    sets.push(`giver_seen_at = NULL`);
  } else {
    // Staff moved the status — flag the thread for the admin and the giver
    sets.push(`is_read = FALSE`);
    sets.push(`giver_seen_at = NULL`);
  }

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE feedback SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows[0]) return null;
  if (isAdmin && (status || priority)) {
    // Clear the receivers' seen state so the action shows as new for them
    await pool.query(`DELETE FROM feedback_views WHERE feedback_id = $1 AND user_id != $2`, [id, actingUser.id]);
  }
  return { item: normalize(rows[0]) };
}

export async function removeFeedback(id) {
  const { rows } = await pool.query(
    `SELECT storage_path FROM feedback_attachments WHERE feedback_id = $1 OR reply_id IN (SELECT id FROM feedback_replies WHERE feedback_id = $1)`,
    [id]
  );
  rows.forEach(a => {
    const filename = a.storage_path.split('/').pop();
    if (filename) {
      fs.promises.unlink(path.join(uploadsDir, filename)).catch(() => {});
    }
  });
  const { rows: del } = await pool.query(`DELETE FROM feedback WHERE id = $1 RETURNING id`, [id]);
  return del.length > 0;
}

// Receivers are resolved as: a specific user > a profession > a role > all staff.
// Admins + the creator + the targeted receivers may access a thread.
function canAccessFeedback(user, fb) {
  if (isAdminUser(user)) return true;
  if (!fb) return false;
  if (fb.user_id === user.id) return true;
  if (fb.target_user_id) return fb.target_user_id === user.id;
  if (fb.target_profession) {
    if (!professionsFor(user).includes(fb.target_profession)) return false;
    if (fb.target_department && fb.target_department !== user.department) return false;
    return true;
  }
  if (fb.target_role) return fb.target_role === user.role;
  if (fb.target_department) return fb.target_department === user.department;
  return true; // general (untargeted) feedback is open to all staff
}

export async function addReply({ feedbackId, user, message, replyToId = 0, attachmentIds = [] }) {
  const { rows: fb } = await pool.query(
    `SELECT id, user_id, user_name, message, department, target_department, target_profession, target_role, target_user_id FROM feedback WHERE id = $1`,
    [feedbackId]
  );
  if (!fb.length) return { error: 'not_found' };
  if (!canAccessFeedback(user, fb[0])) return { error: 'forbidden' };

  const rtId = Number(replyToId) || 0;
  if (rtId > 0) {
    const { rows: rt } = await pool.query(`SELECT id FROM feedback_replies WHERE id = $1 AND feedback_id = $2`, [rtId, feedbackId]);
    if (!rt.length) return { error: 'invalid_reply_to' };
  }

  const { rows } = await pool.query(
    `INSERT INTO feedback_replies (feedback_id, user_id, user_name, user_role, message, reply_to_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [feedbackId, user.id, user.name || user.username, user.role, message, rtId]
  );
  const isAdmin = isAdminUser(user);
  if (isAdmin) {
    // An admin reply notifies the giver and the department receivers (clears their seen state)
    await pool.query(
      `UPDATE feedback SET is_read = TRUE,
         giver_seen_at = CASE WHEN user_id = $2 THEN giver_seen_at ELSE NULL END,
         updated_at = NOW() WHERE id = $1`,
      [feedbackId, user.id]
    );
    await pool.query(`DELETE FROM feedback_views WHERE feedback_id = $1 AND user_id != $2`, [feedbackId, user.id]);
  } else {
    // Any staff activity re-flags the thread for the admin overseer, notifies the
    // giver, and auto-advances a fresh thread to "In Progress" on first response.
    const isCreator = user.id === fb[0].user_id;
    await pool.query(
      `UPDATE feedback SET is_read = FALSE, giver_seen_at = ${isCreator ? 'NOW()' : 'NULL'},
         status = CASE WHEN status = 'new' THEN 'in_progress' ELSE status END,
         updated_at = NOW()
       WHERE id = $1`,
      [feedbackId]
    );
    await pool.query(
      `INSERT INTO feedback_views (feedback_id, user_id) VALUES ($1, $2)
       ON CONFLICT (feedback_id, user_id) DO UPDATE SET seen_at = NOW()`,
      [feedbackId, user.id]
    );
  }
  const replyRow = rows[0];
  const ids = (Array.isArray(attachmentIds) ? attachmentIds : []).map(Number).filter(Boolean);
  if (ids.length) {
    await pool.query(
      `UPDATE feedback_attachments SET reply_id = $1 WHERE id = ANY($2::int[]) AND feedback_id IS NULL AND reply_id IS NULL`,
      [replyRow.id, ids]
    );
    replyRow.attachments = (await pool.query(`SELECT * FROM feedback_attachments WHERE id = ANY($1::int[])`, [ids])).rows.map(normalizeAttachment);
  } else {
    replyRow.attachments = [];
  }
  if (rtId > 0) {
    const { rows: rt } = await pool.query(`SELECT user_name, message FROM feedback_replies WHERE id = $1`, [rtId]);
    replyRow.reply_to_name = rt[0]?.user_name;
    replyRow.reply_to_message = rt[0]?.message;
  }
  return { reply: normalizeReply(replyRow, fb[0]) };
}

export async function getReplies({ feedbackId, user }) {
  const { rows: fb } = await pool.query(
    `SELECT id, user_id, user_name, message, department, target_department, target_profession, target_role, target_user_id FROM feedback WHERE id = $1`,
    [feedbackId]
  );
  if (!fb.length) return { error: 'not_found' };
  if (!canAccessFeedback(user, fb[0])) return { error: 'forbidden' };

  const { rows } = await pool.query(
    `SELECT r.*, r2.user_name AS reply_to_name, r2.message AS reply_to_message,
       COALESCE((
         SELECT json_agg(json_build_object(
           'id', a.id, 'feedbackId', a.feedback_id, 'originalName', a.original_name,
           'mimeType', a.mime_type, 'sizeBytes', a.size_bytes, 'path', a.storage_path,
           'createdAt', a.created_at
         ) ORDER BY a.id)
         FROM feedback_attachments a WHERE a.reply_id = r.id
       ), '[]') AS attachments
     FROM feedback_replies r
     LEFT JOIN feedback_replies r2 ON r2.id = r.reply_to_id
     WHERE r.feedback_id = $1 ORDER BY r.created_at ASC`,
    [feedbackId]
  );
  return { replies: rows.map(r => normalizeReply(r, fb[0])) };
}

export async function markSeen({ feedbackId, user }) {
  const { rows: fb } = await pool.query(
    `SELECT id, user_id, department, target_department, target_profession, target_role, target_user_id FROM feedback WHERE id = $1`,
    [feedbackId]
  );
  if (!fb.length) return { error: 'not_found' };
  if (!canAccessFeedback(user, fb[0])) return { error: 'forbidden' };

  if (isAdminUser(user)) {
    await pool.query(`UPDATE feedback SET is_read = TRUE, updated_at = NOW() WHERE id = $1`, [feedbackId]);
  } else {
    await pool.query(
      `INSERT INTO feedback_views (feedback_id, user_id) VALUES ($1, $2)
       ON CONFLICT (feedback_id, user_id) DO UPDATE SET seen_at = NOW()`,
      [feedbackId, user.id]
    );
    // The giver has now seen the replies on their own feedback
    if (fb[0].user_id === user.id) {
      await pool.query(`UPDATE feedback SET giver_seen_at = NOW() WHERE id = $1`, [feedbackId]);
    }
  }
  // Mark all messages from the other side as seen by this viewer
  await pool.query(
    `UPDATE feedback_replies SET seen_at = NOW() WHERE feedback_id = $1 AND seen_at IS NULL AND user_id != $2`,
    [feedbackId, user.id]
  );
  const { rows } = await pool.query(`SELECT * FROM feedback WHERE id = $1`, [feedbackId]);
  return { feedback: normalize(rows[0]) };
}

export async function getUnreadCount(user) {
  if (isAdminUser(user)) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM feedback WHERE is_read = FALSE`);
    return rows[0].count;
  }
  if (!user.department && !user.profession && !user.role) return 0;
  const profs = professionsFor(user);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM feedback
     WHERE (user_id != $1
        AND (target_user_id = $1
          OR (target_profession = ANY($2::text[]) AND (target_department IS NULL OR target_department = $3))
          OR target_role = $4
          OR (target_department IS NULL AND target_profession IS NULL AND target_role IS NULL AND target_user_id IS NULL))
        AND NOT EXISTS (SELECT 1 FROM feedback_views v WHERE v.feedback_id = feedback.id AND v.user_id = $1))
        OR (user_id = $1 AND giver_seen_at IS NULL AND EXISTS (SELECT 1 FROM feedback_replies r WHERE r.feedback_id = feedback.id))`,
    [user.id, profs.length ? profs : [''], user.department, user.role]
  );
  return rows[0].count;
}

export async function findRecent(user, limit = 8) {
  if (isAdminUser(user)) {
    const { rows } = await pool.query(
      `${FEEDBACK_SELECT} WHERE f.is_read = FALSE ORDER BY f.created_at DESC LIMIT $1`,
      [limit]
    );
    return rows.map(normalize);
  }
  if (!user.department && !user.profession && !user.role) return [];
  const profs = professionsFor(user);
  const { rows } = await pool.query(
    `${FEEDBACK_SELECT} WHERE (f.user_id != $1
        AND (f.target_user_id = $1
          OR (f.target_profession = ANY($2::text[]) AND (f.target_department IS NULL OR f.target_department = $3))
          OR f.target_role = $4
          OR (f.target_department IS NULL AND f.target_profession IS NULL AND f.target_role IS NULL AND f.target_user_id IS NULL))
        AND NOT EXISTS (SELECT 1 FROM feedback_views v WHERE v.feedback_id = f.id AND v.user_id = $1))
       OR (f.user_id = $1 AND f.giver_seen_at IS NULL AND EXISTS (SELECT 1 FROM feedback_replies r WHERE r.feedback_id = f.id))
     ORDER BY f.created_at DESC LIMIT $5`,
    [user.id, profs.length ? profs : [''], user.department, user.role, limit]
  );
  return (await decorateForStaff(rows, user.id)).map(normalize);
}

const AI_PROVIDERS = [
  { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
  { name: 'OpenAI', url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' },
];

const cleanAIText = (t) => {
  if (!t) return '';
  let s = t.trim();
  // Strip common markdown fences and emphasis that models occasionally add
  s = s.replace(/```(?:json)?/gi, '').replace(/`/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^["']|["']$/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
};

const parseAIJson = (content) => {
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (typeof parsed.message === 'string') return parsed;
      // Model may structure the message as sections — flatten them into lines
      if (parsed && typeof parsed.message === 'object' && parsed.message !== null) {
        const parts = Object.values(parsed.message).filter(v => typeof v === 'string');
        if (parts.length) return { ...parsed, message: parts.join('\n') };
      }
    }
  } catch { /* fall through to plain text */ }
  return null;
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Enhance feedback writing: rewrites the message professionally, keeping every
// fact intact, and optionally improves the subject line. Returns structured
// { subject, message } with retries for transient provider failures.
export async function enhanceWithAI({ text, subject = '', category = '' }) {
  const provider = AI_PROVIDERS.find(p => p.key);
  if (!provider) return { error: 'ai_not_configured' };

  const categoryHint = category ? `Category of the feedback: ${category}\n` : '';
  const subjectHint = subject ? `Original subject line: "${subject}"\n` : '';
  const prompt = `You are a professional clinical communication assistant. Rewrite the given hospital feedback so it is clear, respectful and well structured, as a senior colleague would write it.

Rules:
- Keep every fact, number, name, location and meaning EXACTLY as given — never invent or remove details
- Fix grammar, spelling and awkward wording
- Keep the same language as the original text — FIRST detect the language of the original, and if it is NOT English, write BOTH the subject and the message fully in that same language and script
- Write the message in 3 short parts: the situation, why it matters, and what action is requested
- If the original has no action request, do not invent a specific one
- ${categoryHint}${subjectHint}Return ONLY a JSON object, no explanations, no markdown, in this exact shape:
{"subject": "improved subject line, max 8 words, same language", "message": "the improved message as ONE plain-text string, written in flowing sentences (situation, then why it matters, then the request) — do NOT nest objects or use bullet lists inside message"}

ORIGINAL FEEDBACK:
${text.slice(0, 4000)}`;

  const body = {
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  };

  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await fetch(provider.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastErr = err.message;
      if (attempt < 3) { await delay(500 * attempt); continue; }
      break;
    }
    if (response.ok) {
      const data = await response.json().catch(() => null);
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        lastErr = 'empty response';
        if (attempt < 3) { await delay(500 * attempt); continue; }
        break;
      }
      const parsed = parseAIJson(content);
      const message = cleanAIText(parsed?.message || content);
      if (message) {
        return {
          text: message,
          subject: subject ? cleanAIText(parsed?.subject || '') || null : null,
          provider: provider.name,
        };
      }
      lastErr = 'unparseable content';
      if (attempt < 3) { await delay(500 * attempt); continue; }
      break;
    }
    lastErr = `HTTP ${response.status}`;
    // 429 (rate limit) and 5xx are worth retrying; auth errors are not
    if (response.status !== 429 && response.status < 500) break;
    if (attempt < 3) { await delay(700 * attempt); continue; }
  }
  console.error('AI enhance failed:', provider.name, lastErr);
  return { error: 'ai_failed' };
}