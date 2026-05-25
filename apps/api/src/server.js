import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as storage from "./storage.js";
import { importCsv } from "./csv.js";
import { enqueueJob, recoverJobs, initSharedAudio } from "./worker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 4001;

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* Serve generated videos */
app.use(
  "/videos",
  express.static(path.join(__dirname, "../public/videos"), {
    setHeaders: (res) => res.set("Accept-Ranges", "bytes"),
  })
);

/* Serve generated audio */
app.use(
  "/audio",
  express.static(path.join(__dirname, "../public/audio"), {
    setHeaders: (res) => res.set("Cache-Control", "public, max-age=3600"),
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ── Health ─────────────────────────────────────────────── */
app.get("/health", (_, res) =>
  res.json({ ok: true, service: "quizforge-api", ...storage.getStats() })
);

/* ── Stats ──────────────────────────────────────────────── */
app.get("/stats", (_, res) => res.json(storage.getStats()));

/* ── Categories ─────────────────────────────────────────── */
app.get("/categories", async (_, res) => {
  res.json(await storage.getCategories());
});

/* ── Questions ──────────────────────────────────────────── */
app.get("/questions", async (req, res) => {
  try {
    const { category, subcategory, status, limit = "200", offset = "0" } = req.query;
    const result = await storage.getQuestions({
      category,
      subcategory,
      status,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* CSV export with status, used_count, video_ids */
app.get("/questions/export", (req, res) => {
  try {
    const { category, subcategory, status } = req.query;
    const { items } = storage.getQuestions({ category, subcategory, status, limit: 50000 });
    const header = "id,category,subcategory,question,option1,option2,option3,option4," +
      "correct_option,difficulty,tags,image_url,explanation,status,used_count,last_used_at,video_ids\n";
    const rows = items.map((q) => [
      q.id, q.category, q.subcategory,
      csvQ(q.questionText), csvQ(q.option1), csvQ(q.option2), csvQ(q.option3), csvQ(q.option4),
      q.correctOption, q.difficulty,
      Array.isArray(q.tags) ? q.tags.join("|") : "",
      q.imageUrl || "",
      csvQ(q.explanation || ""),
      q.status, q.usedCount,
      q.lastUsedAt || "",
      q.videoIds.join("|"),
    ].join(",")).join("\n");
    const fname = `quizforge-${category || "all"}-${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send(header + rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function csvQ(s) {
  const str = String(s ?? "");
  return (str.includes(",") || str.includes('"') || str.includes("\n"))
    ? '"' + str.replace(/"/g, '""') + '"'
    : str;
}

app.post("/questions", async (req, res) => {
  try {
    res.status(201).json(await storage.addQuestion(req.body));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put("/questions/:id", async (req, res) => {
  try {
    res.json(await storage.updateQuestion(parseInt(req.params.id, 10), req.body));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.delete("/questions/:id", async (req, res) => {
  try {
    await storage.deleteQuestion(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

/* CSV import */
app.post("/questions/csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const result = await importCsv(req.file.buffer.toString("utf-8"));
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* CSV template */
app.get("/csv-template", (_, res) => {
  const header =
    "category,subcategory,question,option1,option2,option3,option4,correct_option,difficulty,tags,image_url,explanation\n";
  const example =
    "Science,Physics,What is the speed of light?,299792458 m/s,199792458 m/s,399792458 m/s,100000000 m/s,1,medium,physics|constants,,Light travels at ~3×10⁸ m/s in vacuum\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="quizforge-template.csv"'
  );
  res.send(header + example);
});

/* ── Videos ─────────────────────────────────────────────── */
app.get("/videos", async (_, res) => {
  res.json(await storage.getVideos());
});

app.post("/videos/generate", async (req, res) => {
  try {
    const {
      category,
      subcategory = "General",
      questionCount = 5,
      theme = "neon",
      questionTime = 10,
      revealAnswer = true,
      avoidDays = 30,
      backgroundStyle = "particles",
      music = "none",
      timingSettings = {},
      introMessage = "",
      outroMessage = "",
    } = req.body;

    if (!category) return res.status(400).json({ error: "category is required" });

    const job = await storage.createVideoJob({
      category,
      subcategory,
      questionCount: Math.min(Math.max(1, parseInt(questionCount, 10)), 20),
      theme,
      questionTime: Math.min(Math.max(5, parseInt(questionTime, 10)), 30),
      revealAnswer: Boolean(revealAnswer),
      avoidDays: parseInt(avoidDays, 10),
      backgroundStyle,
      music,
      timingSettings,
      introMessage,
      outroMessage,
    });

    enqueueJob(job.id);
    res.status(202).json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/videos/:id", async (req, res) => {
  try {
    await storage.deleteVideo(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

/* Bulk generate */
app.post("/videos/bulk-generate", async (req, res) => {
  try {
    const { jobs } = req.body;
    if (!Array.isArray(jobs) || jobs.length === 0)
      return res.status(400).json({ error: "jobs array is required" });
    if (jobs.length > 20)
      return res.status(400).json({ error: "Maximum 20 jobs per bulk request" });

    const created = [];
    for (const cfg of jobs) {
      if (!cfg.category) continue;
      const job = await storage.createVideoJob({
        category:        cfg.category,
        subcategory:     cfg.subcategory     || "General",
        questionCount:   Math.min(Math.max(1, parseInt(cfg.questionCount ?? 5, 10)), 20),
        theme:           cfg.theme           || "neon",
        questionTime:    Math.min(Math.max(5, parseInt(cfg.questionTime  ?? 10, 10)), 30),
        revealAnswer:    cfg.revealAnswer    !== false,
        avoidDays:       parseInt(cfg.avoidDays ?? 30, 10),
        backgroundStyle: cfg.backgroundStyle || "particles",
        music:           cfg.music           || "none",
        timingSettings:  cfg.timingSettings  ?? {},
        introMessage:    cfg.introMessage    ?? "",
        outroMessage:    cfg.outroMessage    ?? "",
      });
      enqueueJob(job.id);
      created.push(job);
    }
    res.status(202).json({ queued: created.length, jobs: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Templates ──────────────────────────────────────────── */
app.get("/templates", (_, res) => {
  try { res.json(storage.getTemplates()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/templates", (req, res) => {
  try {
    const { name, settings } = req.body;
    res.status(201).json(storage.createTemplate(name, settings));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put("/templates/:id", (req, res) => {
  try {
    const { name, settings } = req.body;
    res.json(storage.updateTemplate(parseInt(req.params.id, 10), name, settings));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

app.delete("/templates/:id", (req, res) => {
  try {
    storage.deleteTemplate(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

/* Music tracks available */
app.get("/music", async (req, res) => {
  const musicDir = path.join(__dirname, "../public/music");
  const defined  = ["none", "upbeat", "chill", "dramatic", "energetic", "lofi"];
  try {
    const files = await import("fs").then((m) => m.promises.readdir(musicDir).catch(() => []));
    const available = defined.filter((t) => t === "none" || files.includes(`${t}.mp3`));
    res.json(available);
  } catch {
    res.json(["none"]);
  }
});

/* ── Start ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n🎬  QuizForge API  →  http://localhost:${PORT}\n`);
  initSharedAudio();
  recoverJobs();
});
