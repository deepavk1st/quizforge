/**
 * tests/unit/csv-import.test.js
 * Unit tests for CSV parsing and import validation.
 * Uses sample-import.csv (valid) and invalid-import.csv (invalid rows).
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, loadFixture } from "../lib/csv-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── Required import columns ─────────────────────────────── */
const REQUIRED_COLS = ["category", "subcategory", "question", "option1", "option2", "option3", "option4", "correct_option", "difficulty"];

/* ── Validation helpers (mirror csv.js logic for unit testing) */
function validateImportRow(row) {
  const errors = [];
  for (const col of ["category", "subcategory", "question", "option1", "option2", "option3", "option4"]) {
    if (!row[col] || !row[col].trim()) errors.push(`${col} is required`);
  }
  const co = Number(row.correct_option);
  if (!Number.isInteger(co) || co < 1 || co > 4) errors.push(`correct_option "${row.correct_option}" must be 1–4`);
  // Duplicate options
  const opts = ["option1","option2","option3","option4"].map((k) => (row[k] || "").trim().toLowerCase());
  if (new Set(opts).size < opts.length) errors.push("Duplicate options");
  // Question min length
  if (row.question && row.question.trim().length < 5) errors.push("question too short (< 5 chars)");
  return errors;
}

/* ── Tests ──────────────────────────────────────────────── */
describe("CSV loader – parseCsv()", () => {
  it("parses simple CSV text", () => {
    const text = "name,age\nAlice,30\nBob,25";
    const rows = parseCsv(text);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, "Alice");
    assert.equal(rows[1].age, "25");
  });

  it("handles quoted fields with commas", () => {
    const text = `key,value\nfoo,"bar,baz"\nqux,quux`;
    const rows = parseCsv(text);
    assert.equal(rows[0].value, "bar,baz");
  });

  it("handles escaped quotes inside fields", () => {
    const text = `a,b\n"He said ""hi""",test`;
    const rows = parseCsv(text);
    assert.equal(rows[0].a, 'He said "hi"');
  });

  it("skips empty lines", () => {
    const text = "x,y\n1,2\n\n3,4\n";
    const rows = parseCsv(text);
    assert.equal(rows.length, 2);
  });
});

describe("CSV fixture – sample-import.csv (valid)", () => {
  let rows;
  before(() => { rows = loadFixture("sample-import.csv"); });

  it("loads expected number of rows", () => {
    assert.ok(rows.length >= 5, `Expected ≥5 rows, got ${rows.length}`);
  });

  it("has required columns in every row", () => {
    for (const row of rows) {
      for (const col of REQUIRED_COLS) {
        assert.ok(col in row, `Row missing column "${col}"`);
      }
    }
  });

  it("all rows pass validation", () => {
    for (const row of rows) {
      const errs = validateImportRow(row);
      assert.deepEqual(errs, [], `Row "${row.question}" failed: ${errs.join("; ")}`);
    }
  });

  it("correct_option values are all 1–4", () => {
    for (const row of rows) {
      const co = Number(row.correct_option);
      assert.ok(co >= 1 && co <= 4, `correct_option "${row.correct_option}" out of range`);
    }
  });
});

describe("CSV fixture – invalid-import.csv (negative cases)", () => {
  let rows;
  before(() => { rows = loadFixture("invalid-import.csv"); });

  it("loads expected number of invalid rows", () => {
    assert.ok(rows.length >= 4, `Expected ≥4 invalid rows, got ${rows.length}`);
  });

  it("every row has at least one validation error", () => {
    for (const row of rows) {
      const errs = validateImportRow(row);
      assert.ok(errs.length > 0, `Row "${row.question || "(empty)"}" should have ≥1 error but passed clean`);
    }
  });

  it("detects missing category", () => {
    const row = rows.find((r) => !r.category || !r.category.trim());
    assert.ok(row, "Should have a row with empty category");
    const errs = validateImportRow(row);
    assert.ok(errs.some((e) => e.includes("category")), "Error should mention category");
  });

  it("detects out-of-range correct_option", () => {
    const row = rows.find((r) => Number(r.correct_option) > 4 || isNaN(Number(r.correct_option)));
    assert.ok(row, "Should have a row with bad correct_option");
    const errs = validateImportRow(row);
    assert.ok(errs.some((e) => e.includes("correct_option")), "Error should mention correct_option");
  });

  it("detects duplicate options", () => {
    const row = rows.find((r) => {
      const opts = ["option1","option2","option3","option4"].map((k) => (r[k] || "").trim().toLowerCase());
      return new Set(opts).size < opts.length;
    });
    assert.ok(row, "Should have a row with duplicate options");
    const errs = validateImportRow(row);
    assert.ok(errs.some((e) => e.toLowerCase().includes("duplicate")), "Error should mention duplicate");
  });
});
