/**
 * storage.js — All data access via SQLite (node:sqlite built-in, Node v24+).
 * Interface is async-compatible so existing await callers need no changes.
 */
import db from "./db.js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../data");

/* ── Row mappers ─────────────────────────────────────────── */
function rowToQuestion(row) {
  if (!row) return null;
  return {
    id:           row.id,
    category:     row.category,
    subcategory:  row.subcategory,
    questionText: row.question_text,
    option1:      row.option1,
    option2:      row.option2,
    option3:      row.option3,
    option4:      row.option4,
    correctOption: row.correct_option,
    difficulty:   row.difficulty,
    imageUrl:     row.image_url   ?? "",
    explanation:  row.explanation ?? "",
    tags:         safeJson(row.tags, []),
    sourceCsv:    row.source_csv  ?? "",
    usedCount:    row.used_count,
    status:       row.used_count > 0 ? "used" : "unused",
    lastUsedAt:   row.last_used_at
                    ? new Date(row.last_used_at * 1000).toISOString()
                    : null,
    videoIds:     row.video_ids_str
                    ? row.video_ids_str.split(",").map(Number)
                    : [],
    createdAt:    row.created_at
                    ? new Date(row.created_at * 1000).toISOString()
                    : null,
  };
}

function rowToVideo(row) {
  if (!row) return null;
  return {
    id:              row.id,
    category:        row.category,
    subcategory:     row.subcategory,
    theme:           row.theme,
    questionCount:   row.question_count,
    questionTime:    row.question_time,
    avoidDays:       row.avoid_days,
    revealAnswer:    Boolean(row.reveal_answer),
    backgroundStyle: row.background_style ?? "particles",
    music:           row.music            ?? "none",
    status:          row.status,
    filePath:        row.file_path  ?? null,
    publicUrl:       row.public_url ?? null,
    error:           row.error      ?? null,
    questionIds:     safeJson(row.question_ids, []),
    createdAt:       row.created_at,
    completedAt:     row.completed_at ?? null,
  };
}

function safeJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

/* ── Base SELECT for questions (includes aggregated video_ids) */
const Q_SELECT = `
  SELECT
    q.id, q.category, q.subcategory, q.question_text,
    q.option1, q.option2, q.option3, q.option4,
    q.correct_option, q.difficulty, q.image_url, q.explanation,
    q.tags, q.source_csv, q.used_count, q.last_used_at, q.created_at,
    GROUP_CONCAT(qvm.video_id) AS video_ids_str
  FROM questions q
  LEFT JOIN question_video_map qvm ON q.id = qvm.question_id
`;
const Q_GROUP = " GROUP BY q.id";

/* ── Categories ──────────────────────────────────────────── */
export function getCategories() {
  return safeJson(readFileSync(path.join(DATA, "categories.json"), "utf-8"), []);
}

/* ── Questions ───────────────────────────────────────────── */
export function getQuestions({
  category,
  subcategory,
  status,
  limit  = 200,
  offset = 0,
} = {}) {
  const where = [];
  const vals  = [];

  if (category)          { where.push("q.category = ?");    vals.push(category); }
  if (subcategory)       { where.push("q.subcategory = ?"); vals.push(subcategory); }
  if (status === "unused")  where.push("q.used_count = 0");
  if (status === "used")    where.push("q.used_count > 0");

  const whereSQL = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const total = db.prepare(
    `SELECT COUNT(*) AS cnt FROM questions q${whereSQL}`
  ).get(...vals).cnt;

  const rows = db.prepare(
    `${Q_SELECT}${whereSQL}${Q_GROUP} ORDER BY q.id LIMIT ? OFFSET ?`
  ).all(...vals, limit, offset);

  return { items: rows.map(rowToQuestion), total };
}

export function addQuestion(data) {
  const REQUIRED = [
    "category","subcategory","questionText",
    "option1","option2","option3","option4","correctOption",
  ];
  for (const f of REQUIRED) {
    if (data[f] === undefined || data[f] === null || String(data[f]).trim() === "")
      throw new Error(`addQuestion: required field "${f}" is missing or empty`);
  }
  const co = Number(data.correctOption);
  if (!Number.isInteger(co) || co < 1 || co > 4)
    throw new Error(`addQuestion: correctOption must be 1–4, got "${data.correctOption}"`);

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO questions
      (category, subcategory, question_text, option1, option2, option3, option4,
       correct_option, difficulty, image_url, explanation, tags, source_csv)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    data.category, data.subcategory, data.questionText,
    data.option1, data.option2, data.option3, data.option4,
    co,
    data.difficulty  || "medium",
    data.imageUrl    || "",
    data.explanation || "",
    JSON.stringify(Array.isArray(data.tags) ? data.tags : []),
    data.sourceCsv   || "",
  );

  return rowToQuestion(
    db.prepare(`${Q_SELECT} WHERE q.id = ?${Q_GROUP}`).get(lastInsertRowid)
  );
}

export function addQuestions(items) {
  const stmt = db.prepare(`
    INSERT INTO questions
      (category, subcategory, question_text, option1, option2, option3, option4,
       correct_option, difficulty, image_url, explanation, tags, source_csv)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const ids = [];
  db.exec("BEGIN TRANSACTION");
  try {
    for (const d of items) {
      const { lastInsertRowid } = stmt.run(
        d.category, d.subcategory, d.questionText,
        d.option1, d.option2, d.option3, d.option4,
        Number(d.correctOption),
        d.difficulty  || "medium",
        d.imageUrl    || "",
        d.explanation || "",
        JSON.stringify(Array.isArray(d.tags) ? d.tags : []),
        d.sourceCsv   || "",
      );
      ids.push(lastInsertRowid);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return ids.map((id) =>
    rowToQuestion(db.prepare(`${Q_SELECT} WHERE q.id = ?${Q_GROUP}`).get(id))
  );
}

const QUESTION_FIELD_MAP = {
  questionText:  "question_text",
  option1:       "option1",
  option2:       "option2",
  option3:       "option3",
  option4:       "option4",
  correctOption: "correct_option",
  difficulty:    "difficulty",
  imageUrl:      "image_url",
  explanation:   "explanation",
  tags:          "tags",
  sourceCsv:     "source_csv",
};

export function updateQuestion(id, data) {
  if (!db.prepare("SELECT id FROM questions WHERE id = ?").get(id))
    throw new Error(`Question ${id} not found`);

  const sets = [];
  const vals = [];

  for (const [camel, snake] of Object.entries(QUESTION_FIELD_MAP)) {
    if (data[camel] === undefined) continue;
    sets.push(`${snake} = ?`);
    vals.push(
      camel === "tags"
        ? JSON.stringify(Array.isArray(data.tags) ? data.tags : [])
        : data[camel]
    );
  }

  if (sets.length > 0)
    db.prepare(`UPDATE questions SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);

  return rowToQuestion(db.prepare(`${Q_SELECT} WHERE q.id = ?${Q_GROUP}`).get(id));
}

export function deleteQuestion(id) {
  if (!db.prepare("SELECT id FROM questions WHERE id = ?").get(id))
    throw new Error(`Question ${id} not found`);
  db.prepare("DELETE FROM questions WHERE id = ?").run(id);
}

/* ── Videos ──────────────────────────────────────────────── */
export function getVideos() {
  return db.prepare("SELECT * FROM video_jobs ORDER BY id DESC").all().map(rowToVideo);
}

export function getStuckJobs() {
  return db
    .prepare("SELECT * FROM video_jobs WHERE status IN ('queued','rendering') ORDER BY id ASC")
    .all()
    .map(rowToVideo);
}

export function createVideoJob(config) {
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO video_jobs
      (category, subcategory, theme, question_count, question_time,
       avoid_days, reveal_answer, background_style, music, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,'queued',?)
  `).run(
    config.category,
    config.subcategory      || "",
    config.theme            || "neon",
    config.questionCount    ?? 5,
    config.questionTime     ?? 10,
    config.avoidDays        ?? 30,
    config.revealAnswer ? 1 : 0,
    config.backgroundStyle  || "particles",
    config.music            || "none",
    new Date().toISOString(),
  );
  return rowToVideo(db.prepare("SELECT * FROM video_jobs WHERE id = ?").get(lastInsertRowid));
}

const VIDEO_FIELD_MAP = {
  status:          "status",
  filePath:        "file_path",
  publicUrl:       "public_url",
  error:           "error",
  questionIds:     "question_ids",
  completedAt:     "completed_at",
  backgroundStyle: "background_style",
  music:           "music",
};

export function updateVideoJob(id, updates) {
  if (!db.prepare("SELECT id FROM video_jobs WHERE id = ?").get(id))
    throw new Error(`Video ${id} not found`);

  const sets = [];
  const vals = [];

  for (const [camel, snake] of Object.entries(VIDEO_FIELD_MAP)) {
    if (updates[camel] === undefined) continue;
    sets.push(`${snake} = ?`);
    vals.push(
      camel === "questionIds"
        ? JSON.stringify(updates.questionIds)
        : updates[camel]
    );
  }

  if (sets.length > 0)
    db.prepare(`UPDATE video_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);

  return rowToVideo(db.prepare("SELECT * FROM video_jobs WHERE id = ?").get(id));
}

export function deleteVideo(id) {
  if (!db.prepare("SELECT id FROM video_jobs WHERE id = ?").get(id))
    throw new Error(`Video ${id} not found`);
  db.prepare("DELETE FROM video_jobs WHERE id = ?").run(id);
}

/* ── Question usage (anti-repeat) ────────────────────────── */
export function getUsedIds(category, subcategory, avoidDays = 30) {
  const cutoff = Math.floor(Date.now() / 1000) - avoidDays * 86400;
  const rows = db.prepare(`
    SELECT DISTINCT qvm.question_id
    FROM question_video_map qvm
    JOIN questions q ON q.id = qvm.question_id
    WHERE q.category = ? AND q.subcategory = ? AND qvm.used_at > ?
  `).all(category, subcategory, cutoff);
  return new Set(rows.map((r) => r.question_id));
}

export function markUsed(category, subcategory, ids, videoId) {
  const now        = Math.floor(Date.now() / 1000);
  const insertMap  = db.prepare(
    "INSERT OR IGNORE INTO question_video_map (question_id, video_id, used_at) VALUES (?,?,?)"
  );
  const updateUsed = db.prepare(
    "UPDATE questions SET used_count = used_count + 1, last_used_at = ? WHERE id = ?"
  );

  db.exec("BEGIN TRANSACTION");
  try {
    for (const qId of ids) {
      if (videoId) insertMap.run(qId, videoId, now);
      updateUsed.run(now, qId);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/* ── Stats ───────────────────────────────────────────────── */
export function getStats() {
  const total    = db.prepare("SELECT COUNT(*) AS cnt FROM questions").get().cnt;
  const used     = db.prepare("SELECT COUNT(*) AS cnt FROM questions WHERE used_count > 0").get().cnt;
  const videos   = db.prepare("SELECT COUNT(*) AS cnt FROM video_jobs").get().cnt;
  const complete = db.prepare("SELECT COUNT(*) AS cnt FROM video_jobs WHERE status = 'completed'").get().cnt;
  const byCategory = db.prepare(`
    SELECT category,
           COUNT(*) AS total,
           SUM(CASE WHEN used_count > 0 THEN 1 ELSE 0 END) AS used
    FROM questions GROUP BY category ORDER BY category
  `).all();

  return {
    totalQuestions:  total,
    usedQuestions:   used,
    unusedQuestions: total - used,
    totalVideos:     videos,
    completedVideos: complete,
    byCategory,
  };
}
