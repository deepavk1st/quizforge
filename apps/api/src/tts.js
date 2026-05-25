/**
 * tts.js — Text-to-speech via Google Translate TTS (free, no API key).
 * Generates MP3 files and programmatic WAV sounds (tick, ding).
 */
import https from "https";
import fs from "fs";
import path from "path";

const TTS_SPEED = "0.9";

/* ── Split long text into ≤190-char chunks at word boundaries ── */
function splitText(text, maxLen = 190) {
  if (text.length <= maxLen) return [text];
  const words = text.split(" ");
  const chunks = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen) {
      if (current) chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

async function fetchChunk(text) {
  const encoded = encodeURIComponent(text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob&ttsspeed=${TTS_SPEED}`;
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://translate.google.com/",
        },
      },
      (res) => {
        const bufs = [];
        res.on("data", (c) => bufs.push(c));
        res.on("end", () => resolve(Buffer.concat(bufs)));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("TTS timeout"));
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pathExists(p) {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate MP3 speech → outputPath.
 * Returns true on success, false on failure (never throws).
 */
export async function generateSpeech(text, outputPath) {
  try {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    const chunks = splitText(String(text ?? ""));
    const buffers = [];
    for (let i = 0; i < chunks.length; i++) {
      buffers.push(await fetchChunk(chunks[i]));
      if (i < chunks.length - 1) await sleep(320);
    }
    await fs.promises.writeFile(outputPath, Buffer.concat(buffers));
    return true;
  } catch (err) {
    console.warn(`[tts] "${String(text).slice(0, 50)}…" → ${err.message}`);
    return false;
  }
}

/* ── WAV helper ──────────────────────────────────────────── */
function writeSineWav(outputPath, { sampleRate, duration, samples }) {
  const n = Math.floor(sampleRate * duration);
  const ds = n * 2;
  const buf = Buffer.alloc(44 + ds);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + ds, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);   // PCM
  buf.writeUInt16LE(1, 22);   // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(ds, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-32767, Math.min(32767, Math.round(samples(i / sampleRate) * 32767)));
    buf.writeInt16LE(v, 44 + i * 2);
  }
  fs.writeFileSync(outputPath, buf);
}

/** Generate a short tick WAV (70 ms, 880 Hz sine with sharp decay). */
export async function generateTickWav(outputPath) {
  if (await pathExists(outputPath)) return;
  try {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    writeSineWav(outputPath, {
      sampleRate: 44100,
      duration: 0.07,
      samples: (t) => Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 60) * 0.55,
    });
    console.log("[tts] tick.wav generated.");
  } catch (e) {
    console.warn("[tts] tick.wav failed:", e.message);
  }
}

/** Generate a two-tone ascending ding WAV (200 ms, G5 → C#6). */
export async function generateDingWav(outputPath) {
  if (await pathExists(outputPath)) return;
  try {
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    writeSineWav(outputPath, {
      sampleRate: 44100,
      duration: 0.2,
      samples: (t) => {
        const f = t < 0.1 ? 880 : 1108;
        return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 12) * 0.45;
      },
    });
    console.log("[tts] ding.wav generated.");
  } catch (e) {
    console.warn("[tts] ding.wav failed:", e.message);
  }
}

/**
 * Estimate MP3 audio duration in seconds.
 * Tries ffprobe first; falls back to file-size ÷ bitrate heuristic.
 * Google Translate TTS produces ~32 kbps mono MP3 (≈4 000 bytes/s).
 */
export async function getAudioDuration(filePath) {
  // ffprobe path (optional – silently skipped if not installed)
  try {
    const { execSync } = await import("child_process");
    const out = execSync(
      `ffprobe -i "${filePath}" -show_entries format=duration -v quiet -of csv=p=0`,
      { timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
    )
      .toString()
      .trim();
    const d = parseFloat(out);
    if (!isNaN(d) && d > 0) return d;
  } catch {}

  // Fallback: Google TTS ≈ 32 kbps = 4 000 bytes/s
  try {
    const { size } = await fs.promises.stat(filePath);
    return Math.max(1.5, size / 4000);
  } catch {
    return 4;
  }
}
