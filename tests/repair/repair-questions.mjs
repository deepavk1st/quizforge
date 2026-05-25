#!/usr/bin/env node
/**
 * tests/repair/repair-questions.mjs
 * Scans questions.json, applies auto-fixes, reports results, writes repaired file.
 * Usage: node tests/repair/repair-questions.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, autoFix, validateAll } from "../lib/question-validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "../../apps/api/data/questions.json");
const isDryRun = process.argv.includes("--dry-run");

/* ── Load ────────────────────────────────────────────────── */
const raw = fs.readFileSync(FILE, "utf-8");
const questions = JSON.parse(raw);
console.log(`\n🔧  QuizForge Question Repair Tool`);
console.log(`    File: ${FILE}`);
console.log(`    Mode: ${isDryRun ? "DRY RUN (no writes)" : "WRITE"}`);
console.log(`    Loaded ${questions.length} questions\n`);

/* ── Validate before ─────────────────────────────────────── */
const before = validateAll(questions, { failOnly: true });
console.log(`── Before repair ────────────────────────────────────────`);
console.log(`   Total:    ${before.total}`);
console.log(`   Pass:     ${before.passed}`);
console.log(`   Errors:   ${before.errorCount}`);
console.log(`   Warnings: ${before.warningCount}`);

if (before.errorCount + before.warningCount > 0) {
  console.log(`\n   Issues by question:`);
  for (const pq of before.perQuestion) {
    if (pq.issues.length === 0) continue;
    console.log(`   id=${pq.id} (${pq.category}/${pq.subcategory}):`);
    for (const issue of pq.issues) {
      const icon = issue.severity === "error" ? "✖" : "⚠";
      console.log(`     ${icon} [${issue.rule}] ${issue.message}`);
    }
  }
}

/* ── Apply auto-fixes ────────────────────────────────────── */
let totalFixed = 0;
const repaired = questions.map((q) => {
  const { fixed, fixedFields } = autoFix(q);
  if (fixedFields.length > 0) {
    totalFixed++;
    console.log(`\n   ✔ Auto-fixed id=${q.id}: ${fixedFields.join(", ")}`);
  }
  return fixed;
});

/* ── Validate after ──────────────────────────────────────── */
const after = validateAll(repaired, { failOnly: true });
console.log(`\n── After repair ─────────────────────────────────────────`);
console.log(`   Questions auto-fixed: ${totalFixed}`);
console.log(`   Pass:                 ${after.passed}`);
console.log(`   Errors remaining:     ${after.errorCount}`);
console.log(`   Warnings remaining:   ${after.warningCount}`);

/* ── Remaining issues (need manual fix) ─────────────────── */
if (after.errorCount > 0) {
  console.log(`\n   ⚠ ERRORS that require manual fix:`);
  for (const pq of after.perQuestion) {
    const errs = pq.issues.filter((i) => i.severity === "error");
    if (errs.length === 0) continue;
    console.log(`   id=${pq.id}:`);
    for (const issue of errs) {
      console.log(`     ✖ [${issue.rule}] ${issue.message}`);
    }
  }
}

/* ── Write ───────────────────────────────────────────────── */
if (!isDryRun) {
  // Backup original
  const backupFile = FILE.replace(".json", `.backup-${Date.now()}.json`);
  fs.writeFileSync(backupFile, raw);
  console.log(`\n   📋 Backup saved: ${path.basename(backupFile)}`);

  // Write repaired
  fs.writeFileSync(FILE, JSON.stringify(repaired, null, 2));
  console.log(`   ✅ Repaired file written: ${path.basename(FILE)}`);
} else {
  console.log(`\n   ℹ  Dry run — no changes written.`);
}

console.log(`\n── Done ─────────────────────────────────────────────────\n`);
process.exit(after.errorCount > 0 ? 1 : 0);
