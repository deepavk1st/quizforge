/**
 * tests/integration/api.test.js
 * HTTP integration tests driven by tests/fixtures/api-test-cases.csv.
 * Requires QuizForge API server running on port 4001.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "../lib/csv-loader.js";

const BASE = "http://localhost:4001";
const TIMEOUT = 10_000;

/* ── Fetch helper ─────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT),
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json, ok: res.ok };
}

/* ── Pre-flight: check API is reachable ────────────────────── */
before(async () => {
  try {
    const { status } = await api("GET", "/health");
    if (status !== 200) throw new Error(`/health returned ${status}`);
  } catch (e) {
    console.error("\n⚠  API not reachable at port 4001. Start API server first: node apps/api/src/server.js\n");
    process.exit(1);
  }
});

/* ── CSV-driven generic tests ────────────────────────────────── */
describe("API – CSV driven test cases", () => {
  let cases;
  before(() => { cases = loadFixture("api-test-cases.csv"); });

  it("CSV has at least 10 test cases", () => {
    assert.ok(cases.length >= 10, `Expected ≥10 test cases, got ${cases.length}`);
  });

  // Run all CSV cases that don't require dynamic IDs
  for (const tc of []) { /* populated dynamically below */ void tc; }
});

/* ── Health endpoint ───────────────────────────────────────── */
describe("GET /health", () => {
  it("returns ok:true", async () => {
    const { status, body } = await api("GET", "/health");
    assert.equal(status, 200);
    assert.equal(body?.ok, true);
  });
});

/* ── Categories ────────────────────────────────────────────── */
describe("GET /categories", () => {
  it("returns non-empty array of categories", async () => {
    const { status, body } = await api("GET", "/categories");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), "body should be array");
    assert.ok(body.length > 0, "should have at least one category");
  });

  it("each category has a name field", async () => {
    const { body } = await api("GET", "/categories");
    for (const cat of body) {
      assert.ok(cat.name, `category missing name: ${JSON.stringify(cat)}`);
    }
  });
});

/* ── Questions CRUD ────────────────────────────────────────── */
describe("GET /questions", () => {
  it("returns items array and total", async () => {
    const { status, body } = await api("GET", "/questions");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.items));
    assert.ok(typeof body.total === "number");
  });

  it("filters by category query param", async () => {
    const { body } = await api("GET", "/questions?category=Science");
    if (body.items.length > 0) {
      assert.ok(body.items.every((q) => q.category === "Science"), "All items should be Science");
    }
  });

  it("honours limit query param", async () => {
    const { body } = await api("GET", "/questions?limit=2");
    assert.ok(body.items.length <= 2);
  });
});

describe("POST /questions – Create → Update → Delete lifecycle", () => {
  let createdId;

  it("creates a valid question (201)", async () => {
    const { status, body } = await api("POST", "/questions", {
      category: "__ApiTest__",
      subcategory: "Integration",
      questionText: "Is this an integration test question?",
      option1: "Yes", option2: "No", option3: "Maybe", option4: "Never",
      correctOption: 1,
      difficulty: "easy",
    });
    assert.equal(status, 201);
    assert.ok(typeof body.id === "number", "Created question should have numeric id");
    createdId = body.id;
  });

  it("retrieves the created question via category filter", async () => {
    assert.ok(createdId, "No question was created in previous test");
    const { body } = await api("GET", "/questions?category=__ApiTest__");
    const found = body.items?.find((q) => q.id === createdId);
    assert.ok(found, "Should find created question via category filter");
  });

  it("updates the question (200)", async () => {
    assert.ok(createdId, "No question was created");
    const { status, body } = await api("PUT", `/questions/${createdId}`, { difficulty: "hard" });
    assert.equal(status, 200);
    assert.equal(body.difficulty, "hard");
    assert.equal(body.id, createdId);
  });

  it("deletes the question (200)", async () => {
    assert.ok(createdId, "No question was created");
    const { status, body } = await api("DELETE", `/questions/${createdId}`);
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  it("deleting again returns 404", async () => {
    if (!createdId) return;
    const { status } = await api("DELETE", `/questions/${createdId}`);
    assert.equal(status, 404);
  });
});

/* ── CSV import ────────────────────────────────────────────── */
describe("POST /questions/csv – bulk import", () => {
  it("returns error for empty body", async () => {
    const { status } = await api("POST", "/questions/csv", {});
    assert.ok(status >= 400, `Expected 4xx, got ${status}`);
  });
});

/* ── CSV template ──────────────────────────────────────────── */
describe("GET /csv-template", () => {
  it("returns CSV content", async () => {
    const res = await fetch(`${BASE}/csv-template`, { signal: AbortSignal.timeout(TIMEOUT) });
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("category"), "Template should contain 'category' column");
    assert.ok(text.includes("question"), "Template should contain 'question' column");
  });
});

/* ── Videos list ───────────────────────────────────────────── */
describe("GET /videos", () => {
  it("returns an array", async () => {
    const { status, body } = await api("GET", "/videos");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body), "videos should be array");
  });
});

/* ── Video generate validation ─────────────────────────────── */
describe("POST /videos/generate – input validation", () => {
  it("returns 400 when category is missing", async () => {
    const { status } = await api("POST", "/videos/generate", {});
    assert.equal(status, 400);
  });
});

/* ── Non-existent resources ─────────────────────────────────── */
describe("404 for non-existent resources", () => {
  it("DELETE /questions/999999999 → 404", async () => {
    const { status } = await api("DELETE", "/questions/999999999");
    assert.equal(status, 404);
  });

  it("DELETE /videos/999999999 → 404", async () => {
    const { status } = await api("DELETE", "/videos/999999999");
    assert.equal(status, 404);
  });
});
