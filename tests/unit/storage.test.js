/**
 * tests/unit/storage.test.js
 * Unit tests for apps/api/src/storage.js
 * Tests use actual data files — each test cleans up after itself.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

// Import storage functions under test (absolute path required)
import {
  getQuestions,
  addQuestion,
  addQuestions,
  updateQuestion,
  deleteQuestion,
  getCategories,
} from "../../apps/api/src/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.resolve(__dirname, "../../apps/api/data");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");

/* ── Snapshot / restore helpers ─────────────────────────── */
let snapshot;
before(async () => {
  snapshot = await fs.readFile(QUESTIONS_FILE, "utf-8");
});
after(async () => {
  await fs.writeFile(QUESTIONS_FILE, snapshot);
});

function baseQ(overrides = {}) {
  return {
    category: "__StorageTest__",
    subcategory: "UnitTest",
    questionText: "Is this a storage unit test question?",
    option1: "Yes", option2: "No", option3: "Maybe", option4: "Never",
    correctOption: 1,
    difficulty: "easy",
    ...overrides,
  };
}

/* ── getCategories() ─────────────────────────────────────── */
describe("getCategories()", () => {
  it("returns an array of categories", async () => {
    const cats = await getCategories();
    assert.ok(Array.isArray(cats), "Should be an array");
    assert.ok(cats.length > 0, "Should have at least one category");
  });

  it("each category has name and subcategories", async () => {
    const cats = await getCategories();
    for (const cat of cats) {
      assert.ok(cat.name, "Category should have a name");
    }
  });
});

/* ── getQuestions() ──────────────────────────────────────── */
describe("getQuestions()", () => {
  it("returns items array and total", async () => {
    const result = await getQuestions();
    assert.ok(Array.isArray(result.items), "items should be array");
    assert.ok(typeof result.total === "number", "total should be number");
  });

  it("respects limit parameter", async () => {
    const result = await getQuestions({ limit: 2 });
    assert.ok(result.items.length <= 2, "Should return ≤2 items");
  });

  it("respects offset parameter", async () => {
    const all  = await getQuestions({ limit: 100 });
    if (all.total < 2) return; // not enough data
    const page1 = await getQuestions({ limit: 1, offset: 0 });
    const page2 = await getQuestions({ limit: 1, offset: 1 });
    assert.notDeepEqual(page1.items[0]?.id, page2.items[0]?.id, "Pages should have different items");
  });

  it("filters by category", async () => {
    const q = await addQuestion(baseQ());
    try {
      const result = await getQuestions({ category: "__StorageTest__" });
      assert.ok(result.items.every((i) => i.category === "__StorageTest__"), "All items should match category");
      assert.ok(result.total >= 1);
    } finally {
      await deleteQuestion(q.id);
    }
  });

  it("filters by subcategory", async () => {
    const q = await addQuestion(baseQ({ subcategory: "SubTest" }));
    try {
      const result = await getQuestions({ category: "__StorageTest__", subcategory: "SubTest" });
      assert.ok(result.items.every((i) => i.subcategory === "SubTest"), "All items should match subcategory");
    } finally {
      await deleteQuestion(q.id);
    }
  });
});

/* ── addQuestion() ───────────────────────────────────────── */
describe("addQuestion()", () => {
  it("creates a question with auto-incremented id", async () => {
    const q = await addQuestion(baseQ());
    assert.ok(typeof q.id === "number" && q.id > 0, "Should have numeric id > 0");
    await deleteQuestion(q.id); // cleanup
  });

  it("persists the question so getQuestions can retrieve it", async () => {
    const q = await addQuestion(baseQ({ questionText: "Persist test?" }));
    const result = await getQuestions({ category: "__StorageTest__" });
    const found = result.items.find((i) => i.id === q.id);
    assert.ok(found, "Question should be findable after add");
    await deleteQuestion(q.id);
  });

  it("stores all provided fields", async () => {
    const input = baseQ({ questionText: "Fields test?", difficulty: "hard" });
    const q = await addQuestion(input);
    assert.equal(q.questionText, input.questionText);
    assert.equal(q.difficulty, "hard");
    await deleteQuestion(q.id);
  });
});

/* ── addQuestions() ──────────────────────────────────────── */
describe("addQuestions() bulk insert", () => {
  it("inserts multiple questions and assigns unique ids", async () => {
    const added = await addQuestions([baseQ({ questionText: "Bulk A?" }), baseQ({ questionText: "Bulk B?" })]);
    assert.equal(added.length, 2, "Should return 2 added questions");
    assert.notEqual(added[0].id, added[1].id, "IDs should be unique");
    for (const q of added) await deleteQuestion(q.id);
  });
});

/* ── updateQuestion() ────────────────────────────────────── */
describe("updateQuestion()", () => {
  it("updates specified fields only", async () => {
    const q = await addQuestion(baseQ());
    const updated = await updateQuestion(q.id, { difficulty: "hard" });
    assert.equal(updated.difficulty, "hard");
    assert.equal(updated.questionText, q.questionText, "Other fields unchanged");
    await deleteQuestion(q.id);
  });

  it("throws when id does not exist", async () => {
    await assert.rejects(
      () => updateQuestion(999999999, { difficulty: "easy" }),
      /not found/i
    );
  });
});

/* ── deleteQuestion() ────────────────────────────────────── */
describe("deleteQuestion()", () => {
  it("removes the question from storage", async () => {
    const q = await addQuestion(baseQ());
    await deleteQuestion(q.id);
    const result = await getQuestions({ category: "__StorageTest__" });
    const found = result.items.find((i) => i.id === q.id);
    assert.equal(found, undefined, "Deleted question should not be findable");
  });

  it("throws when id does not exist", async () => {
    await assert.rejects(
      () => deleteQuestion(999999999),
      /not found/i
    );
  });
});
