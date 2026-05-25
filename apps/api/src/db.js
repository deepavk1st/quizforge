/**
 * db.js — SQLite database singleton using Node.js built-in node:sqlite
 * Available natively in Node.js v24+ (no npm install needed).
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.resolve(__dirname, "../data/quizforge.db");

const db = new DatabaseSync(DB_PATH);

/* ── Performance settings ───────────────────────────────── */
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA synchronous = NORMAL");

/* ── Schema ─────────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category       TEXT    NOT NULL,
    subcategory    TEXT    NOT NULL,
    question_text  TEXT    NOT NULL,
    option1        TEXT    NOT NULL,
    option2        TEXT    NOT NULL,
    option3        TEXT    NOT NULL,
    option4        TEXT    NOT NULL,
    correct_option INTEGER NOT NULL CHECK(correct_option BETWEEN 1 AND 4),
    difficulty     TEXT    NOT NULL DEFAULT 'medium'
                           CHECK(difficulty IN ('easy','medium','hard')),
    image_url      TEXT    NOT NULL DEFAULT '',
    explanation    TEXT    NOT NULL DEFAULT '',
    tags           TEXT    NOT NULL DEFAULT '[]',
    source_csv     TEXT    NOT NULL DEFAULT '',
    used_count     INTEGER NOT NULL DEFAULT 0,
    last_used_at   INTEGER,
    created_at     INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS video_jobs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    category       TEXT    NOT NULL,
    subcategory    TEXT    NOT NULL DEFAULT '',
    theme          TEXT    NOT NULL DEFAULT 'neon',
    question_count INTEGER NOT NULL DEFAULT 5,
    question_time  INTEGER NOT NULL DEFAULT 10,
    avoid_days     INTEGER NOT NULL DEFAULT 30,
    reveal_answer  INTEGER NOT NULL DEFAULT 1,
    status         TEXT    NOT NULL DEFAULT 'queued'
                           CHECK(status IN ('queued','rendering','completed','failed')),
    file_path      TEXT,
    public_url     TEXT,
    error          TEXT,
    question_ids   TEXT    NOT NULL DEFAULT '[]',
    created_at     TEXT    NOT NULL,
    completed_at   TEXT
  );

  -- Tracks which questions were used in which videos
  CREATE TABLE IF NOT EXISTS question_video_map (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id)  ON DELETE CASCADE,
    video_id    INTEGER NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
    used_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(question_id, video_id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    settings   TEXT    NOT NULL DEFAULT '{}',
    created_at TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_q_cat     ON questions(category);
  CREATE INDEX IF NOT EXISTS idx_q_subcat  ON questions(category, subcategory);
  CREATE INDEX IF NOT EXISTS idx_q_used    ON questions(used_count);
  CREATE INDEX IF NOT EXISTS idx_vj_status ON video_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_qvm_q     ON question_video_map(question_id);
  CREATE INDEX IF NOT EXISTS idx_qvm_v     ON question_video_map(video_id);
`);

/* ── Safe column migrations (ignore if already exist) ───── */
try { db.exec("ALTER TABLE video_jobs ADD COLUMN background_style TEXT NOT NULL DEFAULT 'particles'"); } catch {}
try { db.exec("ALTER TABLE video_jobs ADD COLUMN music TEXT NOT NULL DEFAULT 'none'"); } catch {}
try { db.exec("ALTER TABLE video_jobs ADD COLUMN timing_settings TEXT NOT NULL DEFAULT '{}'"); } catch {}
try { db.exec("ALTER TABLE video_jobs ADD COLUMN intro_message TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE video_jobs ADD COLUMN outro_message TEXT NOT NULL DEFAULT ''"); } catch {}

export default db;
