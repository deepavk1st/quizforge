import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import * as storage from "./storage.js";
import { generateSpeech, generateTickWav, generateDingWav, getAudioDuration } from "./tts.js";

const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_ENTRY = path.resolve(__dirname, "../../renderer/src/index.tsx");
const PUBLIC_DIR     = path.resolve(__dirname, "../public/videos");
const AUDIO_DIR      = path.resolve(__dirname, "../public/audio");
const SHARED_AUDIO   = path.resolve(__dirname, "../public/audio/shared");

/* ── Shared audio assets (generated once on startup) ───── */
export async function initSharedAudio() {
  await generateTickWav(path.join(SHARED_AUDIO, "tick.wav"));
  await generateDingWav(path.join(SHARED_AUDIO, "ding.wav"));
}

/* ── Bundle cache (reused across jobs) ──────────────────── */
let bundleUrl = null;
async function getBundle() {
  if (!bundleUrl) {
    console.log("[worker] Bundling Remotion compositions…");
    bundleUrl = await bundle({
      entryPoint: RENDERER_ENTRY,
      onProgress: (p) => process.stdout.write(`\r[worker] Bundle: ${p}%  `),
    });
    console.log("\n[worker] Bundle ready.");
  }
  return bundleUrl;
}
/* ── Funny post-answer feedback lines ───────────────── */
const FUNNY_LINES = [
  "Was that too easy, or did it totally trip you up? Drop a comment and let me know!",
  "If you got that right, treat yourself to a snack! You absolutely earned it!",
  "Did that one catch you off guard? Don't worry, now you'll never forget it!",
  "Bet you second-guessed yourself on that one! Always trust your first instinct!",
  "That question separates the legends from the beginners! Which one are you?",
  "Fun fact: now that you know this, you can impress your friends at parties!",
  "If you got that wrong, no shame at all! That's literally why we're here!",
  "The more you learn, the more you realize just how much there is to know!",
  "Boom! Knowledge unlocked! You're getting smarter with every single question!",
  "Whether you knew it or not, you are absolutely crushing this quiz! Keep it up!",
];
/* ── Job queue ───────────────────────────────────────────── */
const queue = [];
let running = false;

export function enqueueJob(jobId) {
  queue.push(jobId);
  if (!running) processNext();
}

/* ── Startup recovery ────────────────────────────────────── */
export async function recoverJobs() {
  const stuck = storage.getStuckJobs();
  if (stuck.length === 0) return;
  console.log(`[worker] Recovering ${stuck.length} interrupted job(s): ${stuck.map((j) => j.id).join(", ")}`);
  for (const job of stuck) {
    await storage.updateVideoJob(job.id, { status: "queued" });
    enqueueJob(job.id);
  }
}

async function processNext() {
  if (queue.length === 0) { running = false; return; }
  running = true;
  const jobId = queue.shift();
  try {
    await renderJob(jobId);
  } catch (err) {
    console.error(`[worker] Job ${jobId} failed:`, err.message);
    await storage.updateVideoJob(jobId, { status: "failed", error: err.message });
  }
  processNext();
}

/* ── Audio generation ───────────────────────────────── */
async function generateJobAudio(jobId, job, preparedQuestions) {
  const audioJobDir = path.join(AUDIO_DIR, String(jobId));
  await fs.promises.mkdir(audioJobDir, { recursive: true });

  const audioFiles = {
    tick: "/audio/shared/tick.wav",
    ding: "/audio/shared/ding.wav",
  };

  console.log(`[worker] Generating TTS audio for job ${jobId}…`);

  const introText = job.introMessage?.trim()
    || `Welcome to the ${job.subcategory || job.category} quiz! Get ready for ${preparedQuestions.length} exciting questions! Let's go!`;
  if (await generateSpeech(introText, path.join(audioJobDir, "intro.mp3")))
    audioFiles.intro = `/audio/${jobId}/intro.mp3`;

  const OPT_LETTERS = ["A", "B", "C", "D"];

  for (let i = 0; i < preparedQuestions.length; i++) {
    const q = preparedQuestions[i];

    // 1. Question text only — timer starts after options are read
    const qText = `Question ${i + 1}! ${q.questionText}`;
    if (await generateSpeech(qText, path.join(audioJobDir, `q${i}.mp3`)))
      audioFiles[`q${i}`] = `/audio/${jobId}/q${i}.mp3`;

    // 2. Each option read individually — displayed one-by-one in sync
    for (let j = 0; j < 4; j++) {
      const optKey = `option${j + 1}`;
      if (q[optKey]) {
        const optText = `${OPT_LETTERS[j]}... ${q[optKey]}`;
        if (await generateSpeech(optText, path.join(audioJobDir, `q${i}opt${j}.mp3`)))
          audioFiles[`q${i}opt${j}`] = `/audio/${jobId}/q${i}opt${j}.mp3`;
      }
    }

    // 3. Answer reveal narration (no reaction prefix — funny feedback is separate)
    const optLetter = OPT_LETTERS[q.correctOption - 1];
    const ansText   = `The correct answer is ${optLetter}! ${q[`option${q.correctOption}`]}!`;
    if (await generateSpeech(ansText, path.join(audioJobDir, `a${i}.mp3`)))
      audioFiles[`a${i}`] = `/audio/${jobId}/a${i}.mp3`;

    // 4. Funny feedback / comment after answer reveal
    const funnyText = FUNNY_LINES[i % FUNNY_LINES.length];
    if (await generateSpeech(funnyText, path.join(audioJobDir, `q${i}funny.mp3`)))
      audioFiles[`q${i}funny`] = `/audio/${jobId}/q${i}funny.mp3`;
  }

  const outroText = job.outroMessage?.trim()
    || "Wow, you made it through the whole quiz! Amazing effort! If you enjoyed this please smash that subscribe button and hit the bell icon so you never miss a quiz! See you in the next one!";
  if (await generateSpeech(outroText, path.join(audioJobDir, "outro.mp3")))
    audioFiles.outro = `/audio/${jobId}/outro.mp3`;

  console.log(`[worker] Audio ready for job ${jobId} — ${Object.keys(audioFiles).length} tracks`);
  return audioFiles;
}

/* ── Core render ─────────────────────────────────────────── */
async function renderJob(jobId) {
  const videos = await storage.getVideos();
  const job = videos.find((v) => v.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  await storage.updateVideoJob(jobId, { status: "rendering" });

  /* Pick questions */
  const { items } = await storage.getQuestions({
    category: job.category,
    subcategory: job.subcategory,
  });
  if (items.length === 0)
    throw new Error(
      `No questions found for ${job.category} / ${job.subcategory}`
    );

  const avoidIds = await storage.getUsedIds(
    job.category,
    job.subcategory,
    job.avoidDays ?? 30
  );

  const pool = items.filter((q) => !avoidIds.has(q.id));
  const source = pool.length >= job.questionCount ? pool : items;

  /* Shuffle + pick */
  const shuffled = source.sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, job.questionCount);

  /* Shuffle options within each question */
  const preparedQuestions = questions.map((q) => {
    const opts = [
      { text: q.option1, correct: q.correctOption === 1 },
      { text: q.option2, correct: q.correctOption === 2 },
      { text: q.option3, correct: q.correctOption === 3 },
      { text: q.option4, correct: q.correctOption === 4 },
    ].sort(() => Math.random() - 0.5);

    const newCorrect = opts.findIndex((o) => o.correct) + 1;
    return {
      ...q,
      option1: opts[0].text,
      option2: opts[1].text,
      option3: opts[2].text,
      option4: opts[3].text,
      correctOption: newCorrect,
    };
  });

  /* Generate audio before rendering */
  const audioFiles = await generateJobAudio(jobId, job, preparedQuestions);

  /* Collect per-track durations for Remotion timing sync */
  console.log(`[worker] Measuring audio durations for job ${jobId}…`);
  const audioJobDir = path.join(AUDIO_DIR, String(jobId));
  const audioDurations = { q: [], opts: [], a: [], funny: [], intro: 3, outro: 8 };
  for (let i = 0; i < preparedQuestions.length; i++) {
    audioDurations.q.push(await getAudioDuration(path.join(audioJobDir, `q${i}.mp3`)));
    const optDurs = [];
    for (let j = 0; j < 4; j++)
      optDurs.push(await getAudioDuration(path.join(audioJobDir, `q${i}opt${j}.mp3`)));
    audioDurations.opts.push(optDurs);
    audioDurations.a.push(await getAudioDuration(path.join(audioJobDir, `a${i}.mp3`)));
    audioDurations.funny.push(await getAudioDuration(path.join(audioJobDir, `q${i}funny.mp3`)));
  }
  if (audioFiles.intro) audioDurations.intro = await getAudioDuration(path.join(audioJobDir, "intro.mp3"));
  if (audioFiles.outro) audioDurations.outro = await getAudioDuration(path.join(audioJobDir, "outro.mp3"));
  console.log(`[worker] Durations: q=[${audioDurations.q.map(d=>d.toFixed(1)).join(",")}] opts=${JSON.stringify(audioDurations.opts.map(o=>o.map(d=>d.toFixed(1))))} a=[${audioDurations.a.map(d=>d.toFixed(1)).join(",")}] funny=[${audioDurations.funny.map(d=>d.toFixed(1)).join(",")}]`);

  /* Output path — format: category_subcategory_difficulty_Q1_QN_YYYYMMDD_HHmmss.mp4 */
  const toSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/, "");
  const catSlug = toSlug(job.category);
  const subSlug = toSlug(job.subcategory);

  /* Dominant difficulty (or "mixed" when questions span multiple levels) */
  const diffCounts = {};
  for (const q of preparedQuestions) {
    const d = (q.difficulty || "unknown").toLowerCase();
    diffCounts[d] = (diffCounts[d] || 0) + 1;
  }
  const topDiff = Object.entries(diffCounts).sort((a, b) => b[1] - a[1])[0][0];
  const diffSlug = diffCounts[topDiff] === preparedQuestions.length ? topDiff : "mixed";

  /* Datetime YYYYMMDD_HHmmss */
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  const datetime = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;

  const qRange   = `Q1_Q${preparedQuestions.length}`;
  const fileName = `${catSlug}_${subSlug}_${diffSlug}_${qRange}_${datetime}.mp4`;
  const outputPath = path.join(PUBLIC_DIR, catSlug, subSlug, fileName);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  /* Ensure browser */
  await ensureBrowser();

  /* Bundle + render */
  const serveUrl = await getBundle();

  const inputProps = {
    questions: preparedQuestions,
    theme: job.theme ?? "neon",
    questionTime: job.questionTime ?? 15,
    revealAnswer: job.revealAnswer ?? true,
    category: job.category,
    subcategory: job.subcategory,
    audioFiles,
    audioDurations,
    backgroundStyle: job.backgroundStyle ?? "particles",
    music:           job.music           ?? "none",
    timingSettings:  job.timingSettings  ?? {},
    apiBase:         "http://localhost:4001",
  };

  const composition = await selectComposition({
    serveUrl,
    id: "QuizVideo",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    overwrite: true,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\r[worker] Job ${jobId}: ${pct}%  `);
    },
  });

  console.log(`\n[worker] Job ${jobId} done → ${outputPath}`);

  /* Save completed job first, then mark questions used (FK requires job to exist) */
  const questionIds = preparedQuestions.map((q) => q.id);
  const publicUrl = `/videos/${catSlug}/${subSlug}/${fileName}`;
  await storage.updateVideoJob(jobId, {
    status: "completed",
    filePath: outputPath,
    publicUrl,
    completedAt: new Date().toISOString(),
    questionIds,
  });

  /* Mark questions used — links question → video in question_video_map */
  await storage.markUsed(job.category, job.subcategory, questionIds, jobId);
}
