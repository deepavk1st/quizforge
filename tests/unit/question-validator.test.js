/**
 * tests/unit/question-validator.test.js
 * Unit tests for the question-validator rules engine.
 * Driven by tests/fixtures/question-quality-rules.csv.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validate, autoFix, RULES } from "../lib/question-validator.js";
import { loadFixture } from "../lib/csv-loader.js";

/* ── Helpers ────────────────────────────────────────────── */
function baseQuestion(overrides = {}) {
  return {
    id: 1,
    category: "Test",
    subcategory: "Unit",
    questionText: "What is the correct answer?",
    option1: "Alpha",
    option2: "Beta",
    option3: "Gamma",
    option4: "Delta",
    correctOption: 1,
    difficulty: "easy",
    imageUrl: "",
    ...overrides,
  };
}

/* ── Rule CSV metadata (informational, does not drive tests) */
let rulesMeta;
describe("Question Validator – CSV rules metadata", () => {
  it("loads quality rules CSV without errors", () => {
    rulesMeta = loadFixture("question-quality-rules.csv");
    assert.ok(Array.isArray(rulesMeta), "Should be array");
    assert.ok(rulesMeta.length > 0, "Should have at least one rule");
    assert.ok(rulesMeta[0].rule_id, "Row should have rule_id column");
  });
});

/* ── Individual rule tests ──────────────────────────────── */
describe("Rule Q001 – questionText not empty", () => {
  it("passes for non-empty text", () => {
    const [r] = validate(baseQuestion(), {}).filter((r) => r.rule === "Q001");
    assert.equal(r.pass, true);
  });
  it("fails for empty questionText", () => {
    const [r] = validate(baseQuestion({ questionText: "" }), {}).filter((r) => r.rule === "Q001");
    assert.equal(r.pass, false);
    assert.equal(r.severity, "error");
  });
});

describe("Rule Q002 – questionText minimum 10 chars", () => {
  it("passes for 10+ chars", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q002");
    assert.equal(r.pass, true);
  });
  it("fails for short text", () => {
    const [r] = validate(baseQuestion({ questionText: "Short?" })).filter((r) => r.rule === "Q002");
    assert.equal(r.pass, false);
  });
});

describe("Rule Q003 – starts with capital", () => {
  it("passes when starts with capital", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q003");
    assert.equal(r.pass, true);
  });
  it("fails and provides autoFix for lowercase start", () => {
    const [r] = validate(baseQuestion({ questionText: "what is this?" })).filter((r) => r.rule === "Q003");
    assert.equal(r.pass, false);
    assert.ok(r.autoFix, "Should have autoFix");
    assert.equal(r.autoFix.value[0], "W");
  });
});

describe("Rule Q004 – ends with punctuation", () => {
  it("passes when ends with ?", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q004");
    assert.equal(r.pass, true);
  });
  it("fails when no terminal punctuation", () => {
    const [r] = validate(baseQuestion({ questionText: "What is the answer" })).filter((r) => r.rule === "Q004");
    assert.equal(r.pass, false);
    assert.ok(r.autoFix?.value.endsWith("?"), "autoFix should append ?");
  });
});

describe("Rule Q005 – no double spaces", () => {
  it("passes for clean text", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q005");
    assert.equal(r.pass, true);
  });
  it("fails and fixes double spaces", () => {
    const [r] = validate(baseQuestion({ questionText: "What  is  this?" })).filter((r) => r.rule === "Q005");
    assert.equal(r.pass, false);
    assert.ok(!/\s{2,}/.test(r.autoFix.value), "Fixed text should have no double spaces");
  });
});

describe("Rule Q006 – all 4 options present", () => {
  it("passes when all options have text", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q006");
    assert.equal(r.pass, true);
  });
  it("fails when option2 is empty", () => {
    const [r] = validate(baseQuestion({ option2: "" })).filter((r) => r.rule === "Q006");
    assert.equal(r.pass, false);
    assert.equal(r.severity, "error");
  });
});

describe("Rule Q007 – unique options", () => {
  it("passes for distinct options", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q007");
    assert.equal(r.pass, true);
  });
  it("fails when two options match case-insensitively", () => {
    const [r] = validate(baseQuestion({ option1: "Alpha", option2: "alpha" })).filter((r) => r.rule === "Q007");
    assert.equal(r.pass, false);
    assert.equal(r.severity, "error");
  });
});

describe("Rule Q008 – correctOption 1–4", () => {
  it("passes for value 1", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q008");
    assert.equal(r.pass, true);
  });
  it("passes for value 4", () => {
    const [r] = validate(baseQuestion({ correctOption: 4 })).filter((r) => r.rule === "Q008");
    assert.equal(r.pass, true);
  });
  it("fails for value 0", () => {
    const [r] = validate(baseQuestion({ correctOption: 0 })).filter((r) => r.rule === "Q008");
    assert.equal(r.pass, false);
  });
  it("fails for value 5", () => {
    const [r] = validate(baseQuestion({ correctOption: 5 })).filter((r) => r.rule === "Q008");
    assert.equal(r.pass, false);
  });
  it("fails for string 'notanumber'", () => {
    const [r] = validate(baseQuestion({ correctOption: "notanumber" })).filter((r) => r.rule === "Q008");
    assert.equal(r.pass, false);
  });
});

describe("Rule Q010 – valid difficulty", () => {
  it("passes for easy", () => {
    const [r] = validate(baseQuestion()).filter((r) => r.rule === "Q010");
    assert.equal(r.pass, true);
  });
  it("passes for hard", () => {
    const [r] = validate(baseQuestion({ difficulty: "hard" })).filter((r) => r.rule === "Q010");
    assert.equal(r.pass, true);
  });
  it("fails for unknown difficulty", () => {
    const [r] = validate(baseQuestion({ difficulty: "extreme" })).filter((r) => r.rule === "Q010");
    assert.equal(r.pass, false);
  });
});

describe("autoFix()", () => {
  it("fixes multiple issues in one pass", () => {
    const q = baseQuestion({ questionText: "what is  this" });
    const { fixed, fixedFields } = autoFix(q);
    assert.ok(fixedFields.length > 0, "Some fields should be fixed");
    assert.match(fixed.questionText, /^W/, "Should start with capital");
    assert.match(fixed.questionText, /[?.!]$/, "Should end with punctuation");
    assert.doesNotMatch(fixed.questionText, /\s{2,}/, "Should remove double spaces");
  });

  it("returns same values when question is already clean", () => {
    const q = baseQuestion();
    const { fixed, fixedFields } = autoFix(q);
    assert.deepEqual(fixed, q);
    assert.equal(fixedFields.length, 0);
  });
});
