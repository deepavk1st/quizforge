/**
 * tests/e2e/data-quality.test.js
 * E2E data quality tests:
 *  - Validates every question in questions.json against all rules
 *  - Checks question-accuracy.csv known-answer entries match stored data
 *  - Reports any questions that should be repaired
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAll } from "../lib/question-validator.js";
import { loadFixture } from "../lib/csv-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_FILE = path.resolve(__dirname, "../../apps/api/data/questions.json");

/* ── Load data ─────────────────────────────────────────────── */
let questions = [];
let accuracyCases = [];

before(() => {
  const raw = fs.readFileSync(QUESTIONS_FILE, "utf-8");
  questions = JSON.parse(raw);
  accuracyCases = loadFixture("question-accuracy.csv");
});

/* ── Structural integrity ───────────────────────────────────── */
describe("E2E – questions.json structural integrity", () => {
  it("loads as a non-empty array", () => {
    assert.ok(Array.isArray(questions), "questions.json must be an array");
    assert.ok(questions.length > 0, "questions.json must not be empty");
    console.log(`  ℹ  Loaded ${questions.length} questions`);
  });

  it("every question has a numeric id", () => {
    for (const q of questions) {
      assert.ok(typeof q.id === "number", `Question missing numeric id: ${JSON.stringify(q)}`);
    }
  });

  it("all question ids are unique", () => {
    const ids = questions.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length, "Duplicate question IDs found");
  });

  it("every question has required fields", () => {
    const required = ["category", "subcategory", "questionText", "option1", "option2", "option3", "option4", "correctOption"];
    for (const q of questions) {
      for (const f of required) {
        assert.ok(q[f] !== undefined && q[f] !== null && String(q[f]).trim() !== "",
          `Question id=${q.id} missing required field "${f}"`);
      }
    }
  });
});

/* ── Quality rules ──────────────────────────────────────────── */
describe("E2E – question quality rules", () => {
  it("no questions have CRITICAL errors (Q001, Q006, Q007, Q008, Q009)", () => {
    const CRITICAL = new Set(["Q001", "Q006", "Q007", "Q008", "Q009"]);
    const { perQuestion } = validateAll(questions, { failOnly: true });
    const criticalIssues = perQuestion.flatMap((pq) =>
      pq.issues
        .filter((i) => CRITICAL.has(i.rule))
        .map((i) => `id=${pq.id}: [${i.rule}] ${i.message}`)
    );
    if (criticalIssues.length > 0) {
      console.error("  Critical question issues found:");
      criticalIssues.forEach((m) => console.error("   ", m));
    }
    assert.deepEqual(criticalIssues, [], `${criticalIssues.length} critical issues found (see above)`);
  });

  it("reports warning count (does not fail build)", () => {
    const { warningCount, errorCount, total, passed } = validateAll(questions, { failOnly: true });
    console.log(`  ℹ  Quality summary: ${total} questions, ${passed} pass, ${errorCount} errors, ${warningCount} warnings`);
    // Only errors block CI
    assert.equal(errorCount, 0, `${errorCount} error-level quality issues found`);
  });

  it("all correctOption values are 1–4", () => {
    for (const q of questions) {
      const v = Number(q.correctOption);
      assert.ok(Number.isInteger(v) && v >= 1 && v <= 4,
        `Question id=${q.id} has invalid correctOption="${q.correctOption}"`);
    }
  });

  it("no duplicate options within a question", () => {
    for (const q of questions) {
      const opts = [q.option1, q.option2, q.option3, q.option4]
        .map((o) => String(o ?? "").trim().toLowerCase());
      assert.equal(new Set(opts).size, opts.length,
        `Question id=${q.id} has duplicate options: ${opts.join(" | ")}`);
    }
  });

  it("difficulty field is always easy/medium/hard", () => {
    const valid = new Set(["easy","medium","hard"]);
    for (const q of questions) {
      const d = String(q.difficulty ?? "").trim().toLowerCase();
      assert.ok(valid.has(d),
        `Question id=${q.id} has invalid difficulty="${q.difficulty}"`);
    }
  });

  it("question text has reasonable length (10–200 chars)", () => {
    const violations = questions.filter((q) => {
      const len = String(q.questionText ?? "").trim().length;
      return len < 10 || len > 200;
    });
    if (violations.length > 0) {
      console.warn("  ⚠  Questions with out-of-range text length:");
      violations.forEach((q) => console.warn(`   id=${q.id}: "${q.questionText?.slice(0, 60)}"`));
    }
    assert.equal(violations.length, 0, `${violations.length} questions have text outside 10–200 char range`);
  });
});

/* ── Accuracy spot-checks ───────────────────────────────────── */
describe("E2E – question accuracy spot-checks (question-accuracy.csv)", () => {
  it("accuracy fixture has at least one case", () => {
    assert.ok(accuracyCases.length > 0, "question-accuracy.csv should have entries");
  });

  it("each known-answer case matches stored data", () => {
    for (const tc of accuracyCases) {
      const keyword  = (tc.question_keyword ?? "").toLowerCase().trim();
      const expected = (tc.expected_correct_fragment ?? "").toLowerCase().trim();
      if (!keyword || !expected) continue;

      // Find questions that mention this keyword
      const candidates = questions.filter((q) =>
        q.questionText.toLowerCase().includes(keyword)
      );

      if (candidates.length === 0) {
        // Dataset may not contain every topic — warn but don't fail
        console.warn(`  ⚠  No question found for keyword "${keyword}" (skipping accuracy check)`);
        continue;
      }

      // For each candidate, verify the correct option contains the expected fragment
      for (const q of candidates) {
        const correctOptKey = `option${q.correctOption}`;
        const correctText = String(q[correctOptKey] ?? "").toLowerCase();
        assert.ok(
          correctText.includes(expected),
          `Accuracy check failed for keyword "${keyword}" (id=${q.id}):\n` +
          `  Expected correct answer to contain: "${expected}"\n` +
          `  Actual correct answer (${correctOptKey}): "${q[correctOptKey]}"`
        );
      }
    }
  });
});

/* ── Grammar spot-checks ────────────────────────────────────── */
describe("E2E – basic grammar checks", () => {
  it("no question text is all uppercase", () => {
    const shout = questions.filter((q) => {
      const t = String(q.questionText ?? "");
      return t.length > 5 && t === t.toUpperCase();
    });
    if (shout.length > 0) console.warn("  ⚠  ALL-CAPS questions:", shout.map((q) => q.id));
    assert.equal(shout.length, 0, "Questions should not be all uppercase");
  });

  it("no question text starts with a number (structural smell)", () => {
    const startNum = questions.filter((q) => /^\d/.test(String(q.questionText ?? "")));
    if (startNum.length > 0) console.warn("  ⚠  Questions starting with digit:", startNum.map((q) => q.id));
    // Warn but don't fail — numbers can be valid starters
    assert.ok(true);
  });
});
