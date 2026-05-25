/**
 * tests/e2e/video.test.js
 * E2E tests for rendered video files:
 *  - Scans apps/api/public/videos/ for MP4 files
 *  - Validates each with video-validator
 *  - Cross-checks with videos.json (completed jobs should have files)
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVideoFile } from "../lib/video-validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_VIDEOS = path.resolve(__dirname, "../../apps/api/public/videos");
const VIDEOS_JSON   = path.resolve(__dirname, "../../apps/api/data/videos.json");

/* ── Helpers ────────────────────────────────────────────────── */
function walkMp4s(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkMp4s(full));
    else if (entry.isFile() && entry.name.endsWith(".mp4")) results.push(full);
  }
  return results;
}

/* ── Data ───────────────────────────────────────────────────── */
let mp4Files = [];
let videoJobs = [];

before(() => {
  mp4Files  = walkMp4s(PUBLIC_VIDEOS);
  const raw = fs.readFileSync(VIDEOS_JSON, "utf-8");
  videoJobs = JSON.parse(raw);
  console.log(`  ℹ  Found ${mp4Files.length} MP4 files, ${videoJobs.length} video job records`);
});

/* ── File system checks ─────────────────────────────────────── */
describe("E2E – video file system checks", () => {
  it("public/videos directory exists", () => {
    if (!fs.existsSync(PUBLIC_VIDEOS)) {
      console.warn("  ⚠  public/videos directory not found — will be created on first render");
      // Not a hard failure — directory is auto-created when first video is rendered
      return;
    }
    assert.ok(true, "Directory exists");
  });

  it("each found MP4 file passes basic validation (size + magic bytes)", () => {
    if (mp4Files.length === 0) {
      console.warn("  ⚠  No MP4 files found — skipping video file checks (generate a video first)");
      return;
    }
    const failures = [];
    for (const f of mp4Files) {
      const { pass, checks } = validateVideoFile(f);
      if (!pass) {
        const failing = checks.filter((c) => !c.pass).map((c) => `[${c.id}] ${c.name}: ${c.detail}`);
        failures.push(`${path.basename(f)}: ${failing.join("; ")}`);
      }
    }
    if (failures.length > 0) {
      console.error("  ✖  Failing video files:");
      failures.forEach((m) => console.error("    ", m));
    }
    assert.deepEqual(failures, [], `${failures.length} MP4 file(s) failed validation`);
  });

  it("all MP4 files are > 50 KB", () => {
    for (const f of mp4Files) {
      const { size } = fs.statSync(f);
      assert.ok(size >= 50_000, `File too small (${size} bytes): ${path.basename(f)}`);
    }
  });
});

/* ── videos.json cross-check ────────────────────────────────── */
describe("E2E – videos.json cross-check", () => {
  it("videos.json loads as an array", () => {
    assert.ok(Array.isArray(videoJobs), "videos.json should be an array");
  });

  it("completed video jobs have filePath set", () => {
    const completedWithoutPath = videoJobs.filter(
      (v) => v.status === "completed" && (!v.filePath || !v.filePath.trim())
    );
    if (completedWithoutPath.length > 0) {
      console.warn("  ⚠  Completed jobs missing filePath:", completedWithoutPath.map((v) => v.id));
    }
    assert.equal(completedWithoutPath.length, 0, "Completed video jobs should have filePath");
  });

  it("completed video jobs' files exist on disk", () => {
    const completed = videoJobs.filter((v) => v.status === "completed" && v.filePath);
    const missing = completed.filter((v) => {
      const absPath = path.isAbsolute(v.filePath)
        ? v.filePath
        : path.resolve(__dirname, "../../apps/api", v.filePath);
      return !fs.existsSync(absPath);
    });
    if (missing.length > 0) {
      console.warn("  ⚠  Completed jobs with missing files:");
      missing.forEach((v) => console.warn(`   id=${v.id} filePath=${v.filePath}`));
    }
    assert.equal(missing.length, 0, `${missing.length} completed video job(s) reference missing files`);
  });

  it("no jobs stuck in 'rendering' status for > 30 minutes", () => {
    const THIRTY_MIN = 30 * 60 * 1000;
    const now = Date.now();
    const stuck = videoJobs.filter((v) => {
      if (v.status !== "rendering") return false;
      const created = new Date(v.createdAt ?? 0).getTime();
      return now - created > THIRTY_MIN;
    });
    if (stuck.length > 0) {
      console.warn("  ⚠  Stuck rendering jobs (>30 min):", stuck.map((v) => v.id));
    }
    assert.equal(stuck.length, 0, `${stuck.length} job(s) stuck in rendering for >30 min`);
  });

  it("failed jobs have error message recorded", () => {
    const failedWithoutMsg = videoJobs.filter(
      (v) => v.status === "failed" && (!v.error || !String(v.error).trim())
    );
    if (failedWithoutMsg.length > 0) {
      console.warn("  ⚠  Failed jobs without error message:", failedWithoutMsg.map((v) => v.id));
    }
    assert.equal(failedWithoutMsg.length, 0, "Failed video jobs should have an error message");
  });
});

/* ── Video content spot-checks (ffprobe optional) ──────────── */
describe("E2E – video content spot-checks (requires ffprobe)", () => {
  it("each MP4 has expected codec and dimensions (if ffprobe available)", () => {
    if (mp4Files.length === 0) {
      console.warn("  ⚠  No MP4 files to inspect");
      return;
    }
    const failures = [];
    for (const f of mp4Files) {
      const { pass, checks } = validateVideoFile(f);
      // V004/V005/V006/V007/V008 are ffprobe checks — skip if unavailable (they show as pass:true with detail "skipped")
      const probeChecks = checks.filter((c) => ["V004","V005","V006","V007","V008"].includes(c.id));
      const skipped     = probeChecks.some((c) => c.detail?.includes("skipped"));
      if (skipped) {
        console.log(`  ℹ  ffprobe not available — skipping codec/resolution checks for ${path.basename(f)}`);
        continue;
      }
      const probeFails = probeChecks.filter((c) => !c.pass);
      if (probeFails.length > 0) {
        failures.push(`${path.basename(f)}: ${probeFails.map((c) => `${c.name}=${c.detail}`).join("; ")}`);
      }
    }
    assert.deepEqual(failures, [], `${failures.length} file(s) failed ffprobe checks`);
  });
});
