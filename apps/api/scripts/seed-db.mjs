#!/usr/bin/env node
/**
 * seed-db.mjs — Seeds the QuizForge SQLite database from CSV question-bank files.
 *
 * Usage:
 *   node apps/api/scripts/seed-db.mjs           # insert new questions (skip duplicates)
 *   node apps/api/scripts/seed-db.mjs --reset   # delete all questions first, then seed
 */
import { parse } from "csv-parse/sync";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.resolve(__dirname, "../data/quizforge.db");
const BANKS_DIR = path.resolve(__dirname, "../data/question-banks");
const RESET     = process.argv.includes("--reset");

/* ── Open / init DB ─────────────────────────────────────── */
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

/* Ensure schema exists (same as db.js — idempotent) */
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
    difficulty     TEXT    NOT NULL DEFAULT 'medium',
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
    status         TEXT    NOT NULL DEFAULT 'queued',
    file_path      TEXT,
    public_url     TEXT,
    error          TEXT,
    question_ids   TEXT    NOT NULL DEFAULT '[]',
    created_at     TEXT    NOT NULL,
    completed_at   TEXT
  );
  CREATE TABLE IF NOT EXISTS question_video_map (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id)  ON DELETE CASCADE,
    video_id    INTEGER NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
    used_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(question_id, video_id)
  );
`);

if (RESET) {
  console.log("⚠  --reset: deleting all existing questions...");
  db.exec("DELETE FROM questions");
}

/* ── Prepared statements ────────────────────────────────── */
const insert = db.prepare(`
  INSERT OR IGNORE INTO questions
    (category, subcategory, question_text, option1, option2, option3, option4,
     correct_option, difficulty, image_url, explanation, tags, source_csv)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

function seedFile(rows, filename) {
  let count = 0;
  db.exec("BEGIN TRANSACTION");
  try {
    for (const row of rows) {
      const correctOption = parseInt(row.correct_option, 10);
      if (![1, 2, 3, 4].includes(correctOption)) {
        console.warn(`  ⚠  Skipping row with invalid correct_option: ${JSON.stringify(row)}`);
        continue;
      }
      if (!row.question || !row.category || !row.subcategory) {
        console.warn(`  ⚠  Skipping incomplete row: ${JSON.stringify(row)}`);
        continue;
      }
      const tags = (row.tags || "").split("|").map((t) => t.trim()).filter(Boolean);
      const { changes } = insert.run(
        row.category.trim(),
        row.subcategory.trim(),
        row.question.trim(),
        (row.option1 || "").trim(),
        (row.option2 || "").trim(),
        (row.option3 || "").trim(),
        (row.option4 || "").trim(),
        correctOption,
        (row.difficulty || "medium").trim(),
        (row.image_url || "").trim(),
        (row.explanation || "").trim(),
        JSON.stringify(tags),
        filename,
      );
      if (changes) count++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return count;
}

/* ── Process each CSV file ──────────────────────────────── */
if (!fs.existsSync(BANKS_DIR)) {
  console.error(`ERROR: question-banks directory not found at ${BANKS_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(BANKS_DIR)
  .filter((f) => f.endsWith(".csv"))
  .sort();

if (files.length === 0) {
  console.error("ERROR: No CSV files found in", BANKS_DIR);
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const content = fs.readFileSync(path.join(BANKS_DIR, file), "utf-8");
  let rows;
  try {
    rows = parse(content, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true,
    });
  } catch (err) {
    console.error(`  ✗  ${file}: parse error — ${err.message}`);
    continue;
  }
  const count = seedFile(rows, file);
  console.log(`  ✔  ${file}: ${count} questions inserted (${rows.length} in file)`);
  total += count;
}

const dbTotal = db.prepare("SELECT COUNT(*) AS cnt FROM questions").get().cnt;
console.log(`\n📊  Seeded: ${total} new questions`);
console.log(`📦  Database total: ${dbTotal} questions\n`);

db.close();
