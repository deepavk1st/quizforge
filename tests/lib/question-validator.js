/**
 * question-validator.js
 * Reusable rules engine for question data quality.
 * Each rule returns: { rule, severity, pass, message, autoFix? }
 */

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

function norm(v) { return String(v ?? "").trim(); }

/** ── Individual rules ─────────────────────────────────── */

export const RULES = {
  /** Q001 Question text must not be empty. */
  Q001_text_not_empty(q) {
    const pass = norm(q.questionText).length > 0;
    return { rule: "Q001", severity: "error", pass, message: "questionText must not be empty" };
  },

  /** Q002 Question text must be at least 10 characters. */
  Q002_text_min_length(q) {
    const pass = norm(q.questionText).length >= 10;
    return { rule: "Q002", severity: "warning", pass, message: "questionText should be ≥ 10 chars" };
  },

  /** Q003 Question text must start with a capital letter. */
  Q003_starts_with_capital(q) {
    const text = norm(q.questionText);
    const pass = /^[A-Z]/.test(text);
    const fix = text ? text[0].toUpperCase() + text.slice(1) : text;
    return { rule: "Q003", severity: "warning", pass, message: "questionText should start with capital", autoFix: { field: "questionText", value: fix } };
  },

  /** Q004 Question must end with punctuation (?, !, .). */
  Q004_ends_with_punctuation(q) {
    const text = norm(q.questionText);
    const pass = /[?.!]$/.test(text);
    const fix = text.endsWith(" ") ? text.trimEnd() + "?" : text + "?";
    return { rule: "Q004", severity: "warning", pass, message: "questionText should end with ?, ! or .", autoFix: { field: "questionText", value: fix } };
  },

  /** Q005 No double spaces in question text. */
  Q005_no_double_spaces(q) {
    const text = norm(q.questionText);
    const pass = !/\s{2,}/.test(text);
    return { rule: "Q005", severity: "warning", pass, message: "questionText has double spaces", autoFix: { field: "questionText", value: text.replace(/\s{2,}/g, " ") } };
  },

  /** Q006 All 4 options must be non-empty. */
  Q006_all_options_present(q) {
    const opts = [q.option1, q.option2, q.option3, q.option4];
    const missing = opts.map((o, i) => norm(o).length === 0 ? `option${i + 1}` : null).filter(Boolean);
    const pass = missing.length === 0;
    return { rule: "Q006", severity: "error", pass, message: `Empty options: ${missing.join(", ") || "none"}` };
  },

  /** Q007 Options must be unique (case-insensitive). */
  Q007_unique_options(q) {
    const opts = [q.option1, q.option2, q.option3, q.option4].map((o) => norm(o).toLowerCase());
    const pass = new Set(opts).size === opts.length;
    return { rule: "Q007", severity: "error", pass, message: "Options must be unique (case-insensitive)" };
  },

  /** Q008 correctOption must be 1–4. */
  Q008_valid_correct_option(q) {
    const v = Number(q.correctOption);
    const pass = Number.isInteger(v) && v >= 1 && v <= 4;
    return { rule: "Q008", severity: "error", pass, message: `correctOption "${q.correctOption}" must be 1–4` };
  },

  /** Q009 The correct option's text must not be empty. */
  Q009_correct_option_not_empty(q) {
    const idx = Number(q.correctOption);
    const key = `option${idx}`;
    const pass = Number.isInteger(idx) && idx >= 1 && idx <= 4 && norm(q[key]).length > 0;
    return { rule: "Q009", severity: "error", pass, message: `Correct option (${key}) is empty` };
  },

  /** Q010 Difficulty must be easy / medium / hard. */
  Q010_valid_difficulty(q) {
    const d = norm(q.difficulty).toLowerCase();
    const pass = VALID_DIFFICULTIES.has(d);
    return { rule: "Q010", severity: "warning", pass, message: `difficulty "${q.difficulty}" must be easy/medium/hard` };
  },

  /** Q011 Question text should not exceed 200 characters. */
  Q011_text_max_length(q) {
    const text = norm(q.questionText);
    const pass = text.length <= 200;
    return { rule: "Q011", severity: "warning", pass, message: "questionText exceeds 200 chars (may overflow video frame)" };
  },

  /** Q012 Each option should be ≥ 2 characters. */
  Q012_options_min_length(q) {
    const opts = [q.option1, q.option2, q.option3, q.option4];
    const short = opts.map((o, i) => norm(o).length > 0 && norm(o).length < 2 ? `option${i + 1}` : null).filter(Boolean);
    const pass = short.length === 0;
    return { rule: "Q012", severity: "warning", pass, message: `Too-short options: ${short.join(", ")}` };
  },

  /** Q013 If imageUrl present, it must be a valid http(s) URL. */
  Q013_valid_image_url(q) {
    if (!norm(q.imageUrl)) return { rule: "Q013", severity: "info", pass: true, message: "No imageUrl (OK)" };
    let pass = false;
    try { const u = new URL(q.imageUrl); pass = u.protocol === "http:" || u.protocol === "https:"; } catch { /* */ }
    return { rule: "Q013", severity: "warning", pass, message: `imageUrl "${q.imageUrl}" is not a valid http(s) URL` };
  },

  /** Q014 Options must start with a capital letter. */
  Q014_options_start_capital(q) {
    const opts = ["option1","option2","option3","option4"];
    const bad = opts.filter((k) => { const v = norm(q[k]); return v.length > 0 && !/^[A-Z0-9(]/.test(v); });
    const pass = bad.length === 0;
    return { rule: "Q014", severity: "info", pass, message: `Options not starting with capital: ${bad.join(", ")}` };
  },
};

/**
 * Run all rules against a single question.
 * Returns array of result objects (only failures if failOnly=true).
 */
export function validate(question, { failOnly = false } = {}) {
  return Object.values(RULES)
    .map((fn) => fn(question))
    .filter((r) => !failOnly || !r.pass);
}

/**
 * Run all rules against an array of questions.
 * Returns { passed, failed, warnings, errors, perQuestion }
 */
export function validateAll(questions, { failOnly = true } = {}) {
  const perQuestion = questions.map((q) => ({
    id: q.id,
    category: q.category,
    subcategory: q.subcategory,
    issues: validate(q, { failOnly }),
  }));

  const allIssues = perQuestion.flatMap((r) => r.issues);
  const errors   = allIssues.filter((r) => r.severity === "error");
  const warnings = allIssues.filter((r) => r.severity === "warning");
  const infos    = allIssues.filter((r) => r.severity === "info");

  return {
    total: questions.length,
    passed: perQuestion.filter((r) => r.issues.length === 0).length,
    failed: perQuestion.filter((r) => r.issues.some((i) => i.severity === "error")).length,
    errorCount: errors.length,
    warningCount: warnings.length,
    infoCount: infos.length,
    perQuestion,
  };
}

/**
 * Apply auto-fixes to a question object.
 * Returns { fixed: Question, fixedFields: string[] }
 */
export function autoFix(question) {
  const q = { ...question };
  const fixedFields = [];
  for (const fn of Object.values(RULES)) {
    const result = fn(q);
    if (!result.pass && result.autoFix) {
      q[result.autoFix.field] = result.autoFix.value;
      fixedFields.push(`${result.rule}:${result.autoFix.field}`);
    }
  }
  return { fixed: q, fixedFields };
}
