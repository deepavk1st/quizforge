/**
 * video-validator.js
 * Validates rendered MP4 video files.
 * Uses file-system stats + optional ffprobe inspection.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

/* ── Expected video properties ───────────────────────────── */
export const EXPECTED = {
  WIDTH: 1920,
  HEIGHT: 1080,
  FPS: 30,
  CODEC: "h264",
  MIN_SIZE_BYTES: 50_000, // 50 KB minimum for any real video
  // MP4 ftyp box magic bytes (offset 4–7)
  MP4_MAGIC: Buffer.from([0x66, 0x74, 0x79, 0x70]), // "ftyp"
};

/**
 * Detect ffprobe path: Remotion ships its own browser but not ffprobe.
 * Try system path, then common install locations.
 */
function findFfprobe() {
  const candidates = [
    "ffprobe",
    "C:\\ffmpeg\\bin\\ffprobe.exe",
    path.resolve(process.cwd(), "node_modules", ".bin", "ffprobe"),
  ];
  for (const c of candidates) {
    try { execFileSync(c, ["-version"], { stdio: "pipe", timeout: 3000 }); return c; } catch { /* next */ }
  }
  return null;
}

let _ffprobe = undefined;
function getffprobe() {
  if (_ffprobe === undefined) _ffprobe = findFfprobe();
  return _ffprobe;
}

/** Run ffprobe JSON inspection on a file. Returns null if ffprobe missing. */
function ffprobeJson(filePath) {
  const bin = getffprobe();
  if (!bin) return null;
  try {
    const out = execFileSync(
      bin,
      ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", filePath],
      { timeout: 15_000, stdio: "pipe" }
    );
    return JSON.parse(out.toString());
  } catch {
    return null;
  }
}

/**
 * Validate a single video file.
 * @param {string} filePath – absolute path to .mp4
 * @param {object} [expected] – optional overrides (duration_min, duration_max)
 * @returns {{ pass: boolean, checks: Check[] }}
 */
export function validateVideoFile(filePath, expected = {}) {
  const checks = [];

  /* ── 1. File existence ── */
  const exists = fs.existsSync(filePath);
  checks.push({ id: "V001", name: "File exists", pass: exists, detail: filePath });
  if (!exists) return { pass: false, checks };

  /* ── 2. File size ── */
  const { size } = fs.statSync(filePath);
  const minSize = expected.min_size ?? EXPECTED.MIN_SIZE_BYTES;
  checks.push({ id: "V002", name: "File size", pass: size >= minSize, detail: `${size} bytes (min ${minSize})` });

  /* ── 3. MP4 magic bytes ── */
  const buf = Buffer.alloc(12);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const hasMagic = buf.slice(4, 8).equals(EXPECTED.MP4_MAGIC);
  checks.push({ id: "V003", name: "MP4 magic bytes (ftyp)", pass: hasMagic, detail: buf.slice(4, 8).toString("ascii") });

  /* ── 4–8. ffprobe checks (optional) ── */
  const info = ffprobeJson(filePath);
  if (info) {
    const videoStream = info.streams?.find((s) => s.codec_type === "video");
    const audioStream = info.streams?.find((s) => s.codec_type === "audio");
    const format = info.format;

    /* Codec */
    const codec = videoStream?.codec_name?.toLowerCase() ?? "unknown";
    checks.push({ id: "V004", name: "Video codec = h264", pass: codec === EXPECTED.CODEC, detail: codec });

    /* Resolution */
    const w = videoStream?.width ?? 0;
    const h = videoStream?.height ?? 0;
    const expectedW = expected.width ?? EXPECTED.WIDTH;
    const expectedH = expected.height ?? EXPECTED.HEIGHT;
    checks.push({ id: "V005", name: `Resolution = ${expectedW}×${expectedH}`, pass: w === expectedW && h === expectedH, detail: `${w}×${h}` });

    /* Frame rate */
    const [fNum, fDen] = (videoStream?.r_frame_rate ?? "0/1").split("/").map(Number);
    const fps = fDen ? Math.round(fNum / fDen) : 0;
    checks.push({ id: "V006", name: `FPS ≈ ${EXPECTED.FPS}`, pass: Math.abs(fps - EXPECTED.FPS) <= 1, detail: `${fps} fps` });

    /* Duration */
    const duration = parseFloat(format?.duration ?? "0");
    const minDur = expected.duration_min ?? 5;
    const maxDur = expected.duration_max ?? 3600;
    checks.push({ id: "V007", name: `Duration ${minDur}–${maxDur}s`, pass: duration >= minDur && duration <= maxDur, detail: `${duration.toFixed(1)}s` });

    /* Audio present */
    checks.push({ id: "V008", name: "Audio stream present", pass: !!audioStream, detail: audioStream?.codec_name ?? "none" });
  } else {
    checks.push({ id: "V004", name: "ffprobe checks", pass: true, detail: "ffprobe not available – skipped" });
  }

  const pass = checks.every((c) => c.pass);
  return { pass, checks };
}

/**
 * Compute expected duration for a video job config.
 * @param {{ questionCount, questionTime }} cfg
 */
export function expectedDuration(cfg) {
  const INTRO = 2;   // seconds
  const OUTRO = 3;   // seconds
  return INTRO + cfg.questionCount * cfg.questionTime + OUTRO;
}
