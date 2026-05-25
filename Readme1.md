# QuizForge

> **Programmatic quiz video generator** — React-powered compositions rendered to 1920×1080 MP4 via Remotion, with AI-generated female voice narration, served by an Express REST API, managed through a feature-rich React dashboard.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Workspace Structure](#workspace-structure)
4. [Getting Started](#getting-started)
5. [Apps](#apps)
   - [API (`apps/api`)](#api-appsapi)
   - [Web Dashboard (`apps/web`)](#web-dashboard-appsweb)
   - [Renderer (`apps/renderer`)](#renderer-appsrenderer)
6. [REST API Reference](#rest-api-reference)
7. [Video Generation](#video-generation)
8. [Audio & TTS](#audio--tts)
9. [Visual Themes](#visual-themes)
10. [Background Styles](#background-styles)
11. [Background Music](#background-music)
12. [Dashboard Features](#dashboard-features)
13. [Question Management](#question-management)
14. [CSV Import / Export](#csv-import--export)
15. [Bulk Video Generation](#bulk-video-generation)
16. [Test Suite](#test-suite)
17. [Repair Tool](#repair-tool)
18. [Data Files](#data-files)
19. [Known Limitations](#known-limitations)

---

## Project Overview

QuizForge automates the creation of engaging quiz videos for YouTube, TikTok, educational platforms, and e-learning. Supply a question bank (JSON or CSV), choose a category, visual theme, background style, and background music — QuizForge renders a fully animated 1920×1080 MP4 with:

- **AI female voice narration** — question read-out, funny reaction phrases, answer reveal, intro/outro speech (Google TTS, no API key needed)
- **Ticking countdown sound** during question time; **ding** on answer reveal
- **Subscribe CTA scene** at the end of every video — animated 🔔 bell, staggered "SUBSCRIBE" letters, bell-icon prompt
- Animated question cards with staggered answer options and highlight-on-reveal
- Countdown timer ring per question; answer revealed at 65% of question time
- **8 vibrant dark themes** (neon, sunset, ocean, forest, galaxy, candy, fire, retro)
- **4 background animation styles** (particles, geometric, waves, matrix)
- Optional **background music track** (user-supplied MP3s)
- Gradient progress bar; animated intro scene
- Startup recovery — interrupted render jobs automatically resume on restart

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Web Dashboard  (React 18 + Vite 5 · port 5174)         │
│  Dashboard · Generate · Bulk · Questions · Videos       │
└───────────────────┬─────────────────────────────────────┘
                    │ /api  proxy
┌───────────────────▼─────────────────────────────────────┐
│  REST API  (Express ESM · port 4001)                     │
│  server.js · storage.js · csv.js · worker.js · tts.js   │
│  SQLite (node:sqlite built-in)                           │
└───────────────────┬─────────────────────────────────────┘
                    │ generateJobAudio() + renderMedia()
┌───────────────────▼─────────────────────────────────────┐
│  TTS Engine  (Google Translate TTS · no key needed)      │
│  tts.js: intro · q0…qN · a0…aN · outro + tick/ding WAV  │
└───────────────────┬─────────────────────────────────────┘
                    │ inputProps (audioFiles, theme, bg, music)
┌───────────────────▼─────────────────────────────────────┐
│  Renderer  (Remotion v4 · TypeScript + React)            │
│  QuizVideo → IntroScene → QuestionScene(s) →            │
│  SubscribeScene                                          │
└─────────────────────────────────────────────────────────┘
```

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces |
| Dev runner | `concurrently` |
| API | Express 4, ESM (`"type":"module"`) |
| Storage | SQLite via `node:sqlite` built-in (WAL mode) |
| TTS | Google Translate TTS (free, unofficial, no key) |
| Video engine | Remotion v4 (`@remotion/bundler`, `@remotion/renderer`) |
| UI | React 18, Vite 5, lucide-react |
| Testing | Node.js built-in `node:test` + `node:assert` |
| Node version | v24+ |

---

## Workspace Structure

```
QuizForge/
├── package.json                  # root workspace, scripts
├── Readme1.md
│
├── apps/
│   ├── api/                      # Express REST API
│   │   ├── src/
│   │   │   ├── server.js         # route definitions + static serving
│   │   │   ├── storage.js        # SQLite CRUD (questions, videos, usage)
│   │   │   ├── db.js             # SQLite singleton + schema migrations
│   │   │   ├── csv.js            # CSV import parser
│   │   │   ├── worker.js         # Remotion render queue + audio generation
│   │   │   └── tts.js            # Google TTS + tick/ding WAV generators
│   │   ├── data/
│   │   │   ├── quizforge.db      # SQLite database
│   │   │   ├── questions.json    # seed / legacy
│   │   │   ├── categories.json
│   │   │   ├── videos.json
│   │   │   └── question-usage.json
│   │   └── public/
│   │       ├── videos/           # rendered MP4 output
│   │       ├── audio/            # per-job TTS + shared/tick.wav, ding.wav
│   │       └── music/            # user-supplied background MP3s
│   │
│   ├── web/                      # React dashboard
│   │   ├── src/
│   │   │   ├── App.jsx           # all panels (Dashboard/Generate/Bulk/Questions/Videos)
│   │   │   ├── main.jsx
│   │   │   └── styles.css
│   │   ├── index.html
│   │   └── vite.config.js        # proxies /api → localhost:4001
│   │
│   └── renderer/                 # Remotion compositions
│       └── src/
│           ├── Root.tsx           # registers composition + calculateMetadata
│           ├── QuizVideo.tsx      # sequences Intro→Questions→Subscribe + bg music
│           ├── types.ts           # ThemeName, BackgroundStyle, MusicTrack, VideoInputProps
│           ├── themes.ts          # 8 theme configs
│           ├── scenes/
│           │   ├── IntroScene.tsx      # 3s intro with audio
│           │   ├── QuestionScene.tsx   # TTS + tick + ding + answer audio
│           │   └── SubscribeScene.tsx  # 6s animated subscribe CTA
│           └── components/
│               ├── AnswerOption.tsx
│               ├── TimerRing.tsx
│               ├── ProgressBar.tsx
│               └── BackgroundEffects.tsx  # particles/geometric/waves/matrix
│
└── tests/
    ├── lib/
    │   ├── question-validator.js
    │   ├── video-validator.js
    │   └── csv-loader.js
    ├── fixtures/
    │   ├── api-test-cases.csv
    │   ├── question-quality-rules.csv
    │   ├── question-accuracy.csv
    │   ├── sample-import.csv
    │   └── invalid-import.csv
    ├── unit/
    │   ├── question-validator.test.js
    │   ├── csv-import.test.js
    │   └── storage.test.js
    ├── integration/
    │   └── api.test.js
    ├── e2e/
    │   ├── data-quality.test.js
    │   └── video.test.js
    └── repair/
        └── repair-questions.mjs
```

---

## Getting Started

### Prerequisites

- Node.js v24+
- npm v10+
- (Optional) ffprobe in PATH for codec/resolution checks in video tests

### Install

```powershell
cd E:\QuizForge
npm install
```

### Run (both servers)

```powershell
npm run dev
```

Or individually:

```powershell
# API only (port 4001)
npm run dev:api

# Web only (port 5174)
npm run dev:web

# Remotion Studio (visual preview)
npm run studio
```

Open **http://localhost:5174** for the dashboard.

---

## Apps

### API (`apps/api`)

Express server with ESM modules on **port 4001**. Data is persisted in SQLite (`apps/api/data/quizforge.db`).

On startup the server:
1. Generates `public/audio/shared/tick.wav` and `ding.wav` if missing
2. Recovers any jobs stuck in `queued` or `rendering` status (restart-safe)

**Modules:**

| File | Responsibility |
|------|---------------|
| `server.js` | Route definitions, static serving of `/videos`, `/audio`, `/music` |
| `storage.js` | `getQuestions`, `createVideoJob`, `updateVideoJob`, `deleteVideo`, `getUsedIds`, `markUsed`, `getStuckJobs` |
| `db.js` | SQLite singleton, schema creation, safe `ALTER TABLE` migrations |
| `csv.js` | Parse CSV text → validate → bulk insert |
| `worker.js` | `enqueueJob`, `recoverJobs`, `initSharedAudio`, `generateJobAudio`, Remotion `renderMedia` |
| `tts.js` | `generateSpeech(text, path)` via Google TTS; `generateTickWav`, `generateDingWav` (pure PCM, no npm deps) |

---

### Web Dashboard (`apps/web`)

Single-page React app with **5 panels**:

| Panel | Features |
|-------|---------|
| **Dashboard** | Live stats, recent video activity, quick-generate shortcut |
| **Generate** | Category/subcategory, question count, seconds per question, **target duration shortcuts** (1m–10m), reveal toggle, avoid-days, **8-theme picker**, **background style picker**, **music picker**, live preview, queue button |
| **Bulk** | Table UI — add/remove rows (up to 20), per-row category/subcategory/count/theme/background/music/reveal controls, single-click queue all |
| **Questions** | Full table with search, category filter, inline edit, delete, CSV drag-and-drop import |
| **Videos** | Status filter, video cards with download/delete, auto-refresh while rendering |

**Proxy:** All `/api/*` calls forwarded to `http://localhost:4001` via `vite.config.js`.

---

### Renderer (`apps/renderer`)

Remotion compositions written in TypeScript + React. Registered in `Root.tsx` with **fully dynamic duration** calculated from real TTS audio lengths:

```
Total frames = 90 (intro 3s)
             + Σ questionSceneFrames(qTts, optsTts[A..D], answerTts, funnyTts, timerSec)
             + 180 (subscribe 6s)
```

Each question scene duration is driven by actual TTS audio measured via `ffprobe` (falls back to file-size estimation). No hardcoded timings — the video is exactly as long as the content needs to be.

**Output:** 1920 × 1080 px, 30 fps, H.264 MP4.

---

## REST API Reference

Base URL: `http://localhost:4001`

### Health

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/health` | `{ ok, service, totalQuestions, totalVideos, … }` |

### Categories

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/categories` | `[{ name, subcategories[] }]` |

### Questions

| Method | Path | Body / Query | Response |
|--------|------|-------------|----------|
| `GET` | `/questions` | `?category=&subcategory=&limit=50&offset=0` | `{ items[], total }` |
| `POST` | `/questions` | Question object | `201 { id, …question }` |
| `PUT` | `/questions/:id` | Partial question fields | `200` updated |
| `DELETE` | `/questions/:id` | — | `200 { ok: true }` |
| `POST` | `/questions/csv` | multipart `file` | `{ imported, skipped, errors[] }` |
| `GET` | `/csv-template` | — | CSV file download |

### Videos

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/videos` | — | `[VideoJob]` |
| `POST` | `/videos/generate` | see [Video Generation](#video-generation) | `202 VideoJob` |
| `POST` | `/videos/bulk-generate` | `{ jobs: [...] }` (max 20) | `{ queued, jobs[] }` |
| `DELETE` | `/videos/:id` | — | `200 { ok: true }` |

### Music

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/music` | Array of available track names from `public/music/` |

### Static files

| Path | Serves |
|------|--------|
| `/videos/<category>/<sub>/…mp4` | Rendered MP4 files |
| `/audio/<jobId>/…mp3` | Per-job TTS audio |
| `/audio/shared/tick.wav` | Shared tick sound |
| `/audio/shared/ding.wav` | Shared ding sound |
| `/music/…mp3` | Background music tracks |

---

## Per-Question Video Flow

Each question follows this exact 5-step sequence, fully driven by real TTS audio durations:

| Step | What happens | Audio | Visual |
|------|-------------|-------|--------|
| **1 — Question read** | Question text spoken aloud | `q{i}.mp3` | Question text visible, options hidden |
| **2 — Options revealed** | Each option (A → D) read one by one | `q{i}opt0.mp3` … `q{i}opt3.mp3` (one per option) | Each option slides in from left as it is read |
| **3 — Timer countdown** | Thinking time begins after all 4 options shown | `tick.wav` loops (one tick/second) | Timer ring counts down, progress bar fills |
| **4 — Answer revealed** | Timer hits 0; correct answer highlighted | `ding.wav` then `a{i}.mp3` "The correct answer is X!" | Correct option glows, wrong options dim |
| **5 — Funny feedback** | Funny/encouraging comment about the question | `q{i}funny.mp3` | Answer stays highlighted |

This repeats for every question. After the final question, the subscribe/bell CTA scene plays.

### Timing constants (`Root.tsx`)

| Constant | Frames | Time | Purpose |
|----------|--------|------|---------|
| `Q_TTS_START` | 5 | 0.17 s | Delay before question TTS begins |
| `TIMER_GAP` | 20 | 0.67 s | Pause after last option is read before timer starts |
| `DING_OFFSET` | 15 | 0.5 s | Gap between ding sound and answer narration |
| `ANSWER_BUFFER` | 75 | 2.5 s | Hold on revealed answer after funny TTS finishes |
| `FADE_OUT` | 24 | 0.8 s | Scene exit fade |

### Audio sync timeline (one question)

```
[0]   [5]   [~13s]              [~21s]  TIMER_GAP  [~22s]          [~37s]     [~41s]     [~45s]
 |     |       |                  |         |          |               |           |          |
 |entry| qTTS  | A... | B... | C... | D... |  gap  | countdown  |ding+answer| funny TTS | fade
                                                       ← tick tick tick tick →
```

All timings are dynamic — values above are typical examples.

---

## Video Generation

### `POST /videos/generate` body

| Field | Default | Description |
|-------|---------|-------------|
| `category` | *(required)* | Question category |
| `subcategory` | `"General"` | Subcategory filter |
| `questionCount` | `5` | Questions to include (1–20) |
| `questionTime` | `10` | Seconds per question (5–30) |
| `theme` | `"neon"` | Visual theme — see [Visual Themes](#visual-themes) |
| `revealAnswer` | `true` | Highlight correct option at 65% of question time |
| `avoidDays` | `30` | Skip questions used within this many days |
| `backgroundStyle` | `"particles"` | Background animation — see [Background Styles](#background-styles) |
| `music` | `"none"` | Background music track name |

### Pipeline

1. `POST /videos/generate` creates a DB record with `status: "queued"`
2. `worker.js` picks it up, selects + shuffles questions (respects `avoidDays`)
3. Pre-generates all TTS audio for the job to `public/audio/<jobId>/`
4. Calls Remotion `bundle()` (cached after first call) then `renderMedia()`
5. Outputs `public/videos/<category>/<subcategory>/video-<id>-<ts>-<rand>.mp4`
6. Updates job to `status: "completed"`, marks questions used

---

## Audio & TTS

Audio is generated **before** rendering so that Remotion can reference real files synchronously.

### What gets generated per job

| File | Content |
|------|---------|
| `intro.mp3` | "Welcome to the ___ quiz! Get ready for N questions!" |
| `q0.mp3 … qN.mp3` | Question text only (no options) |
| `q0opt0–3.mp3 … qNopt0–3.mp3` | Each option read individually: "A... [text]", "B... [text]", etc. |
| `a0.mp3 … aN.mp3` | "The correct answer is X! [correct option text]!" |
| `q0funny.mp3 … qNfunny.mp3` | Funny/encouraging feedback after answer reveal |
| `outro.mp3` | Subscribe + bell icon CTA speech |

### Shared assets (generated once on startup)

| File | Description |
|------|-------------|
| `public/audio/shared/tick.wav` | 70ms 880Hz sine with exponential decay |
| `public/audio/shared/ding.wav` | 200ms two-tone ascending (880→1108Hz) |

### Funny feedback phrases (10 rotating)

> "Was that too easy, or did it totally trip you up? Drop a comment!"\
> "If you got that right, treat yourself to a snack! You earned it!"\
> "Did that one catch you off guard? Now you'll never forget it!"\
> … *(10 total, cycle by question index)*

### Implementation details

- Uses Google Translate TTS (`translate.google.com/translate_tts`) — free, no API key
- Texts > 190 chars are split at word boundaries and fetched as chunks
- 320ms sleep between chunks to avoid rate limiting
- Audio duration measured via `ffprobe` (fallback: file-size / 4000 bytes/s ≈ 32 kbps)
- Pure-Node WAV generation (no npm packages) via raw PCM Buffer writing

---

## Visual Themes

| Theme | Vibe | Primary | Accent |
|-------|------|---------|--------|
| `neon` | Dark purple sci-fi | Purple | Pink |
| `sunset` | Dark warm | Orange | Red |
| `ocean` | Dark navy | Sky blue | Cyan |
| `forest` | Dark green | Green | Teal |
| `galaxy` | Deep space | Electric violet | Bright cyan |
| `candy` | Neon pop | Hot pink | Neon yellow |
| `fire` | Blazing | Bright orange | Red |
| `retro` | 80s synthwave | Teal | Coral/lime |

Each theme defines: `background`, `primary`, `secondary`, `accent`, `text`, `textMuted`, `surface`, `badgeGradient`, `correctColor`, `correctGlow`, `progressGradient`, `timerColor`, `particleColor`, `gridColor`, `fontFamily`.

---

## Background Styles

| Style | Description |
|-------|-------------|
| `particles` | Floating glowing orbs + animated grid lines (default) |
| `geometric` | Rotating polygon outlines (triangles, squares, hexagons) |
| `waves` | Animated sine wave polylines |
| `matrix` | Falling katakana characters (Matrix-style rain) |

---

## Background Music

Place MP3 files in `apps/api/public/music/` with these exact names:

| File | Track style |
|------|------------|
| `upbeat.mp3` | Energetic, fast-paced |
| `chill.mp3` | Relaxed, laid-back |
| `dramatic.mp3` | Cinematic tension |
| `energetic.mp3` | High-energy |
| `lofi.mp3` | Lo-fi hip-hop |

Music plays at **18% volume** throughout the full video. The `none` option (default) skips music entirely.

---

## Dashboard Features

### Generate panel extras

- **Target duration shortcuts** — click 1m / 2m / 3m / 5m / 10m to auto-calculate `questionCount` based on current `questionTime`
- **Estimated duration** shown below the shortcuts
- **Background style picker** — 4-option icon grid
- **Music picker** — 6-option icon grid

### Bulk Generate panel

Queue up to 20 videos in one click. Each row in the table independently controls:
category, subcategory, question count, theme, background style, music, reveal answer

After submitting, a confirmation shows how many were queued.

---

## Question Management

Questions are stored in SQLite. Each question:

```json
{
  "id": 1,
  "category": "Science",
  "subcategory": "Chemistry",
  "questionText": "What is the atomic number of Carbon?",
  "option1": "6",
  "option2": "12",
  "option3": "8",
  "option4": "14",
  "correctOption": 1,
  "difficulty": "easy",
  "explanation": "Carbon has 6 protons, giving it atomic number 6.",
  "tags": ["chemistry", "periodic table"]
}
```

**Validation rules:**
- `questionText`, `option1–4`, `category`, `subcategory`, `correctOption` must be non-empty
- `correctOption` must be an integer 1–4

---

## CSV Import / Export

### Import format

```csv
category,subcategory,question,option1,option2,option3,option4,correct_option,difficulty,tags,image_url,explanation
Science,Chemistry,What is H2O?,Water,Salt,Sugar,Sand,1,easy,chemistry|water,,Water is H2O.
```

- **Required columns:** `category`, `subcategory`, `question`, `option1–4`, `correct_option`
- `correct_option` must be `1`–`4`; `tags` is pipe-separated
- Rows with errors are skipped; response includes `errors[]` with line numbers

### Download template

```
GET http://localhost:4001/csv-template
```

### Drag-and-drop import

Drop a `.csv` file onto the **Questions** panel in the web dashboard.

---

## Bulk Video Generation

```http
POST /videos/bulk-generate
Content-Type: application/json

{
  "jobs": [
    { "category": "Science", "subcategory": "Chemistry", "questionCount": 5, "theme": "galaxy", "backgroundStyle": "matrix", "music": "dramatic" },
    { "category": "History", "questionCount": 8, "theme": "retro", "backgroundStyle": "waves", "music": "lofi" }
  ]
}
```

Returns: `{ "queued": 2, "jobs": [...] }`

Max 20 jobs per request. Jobs are processed sequentially by the render worker.

---

## Test Suite

### Run tests

```powershell
# All non-integration tests (no server needed)
npm run test:unit
npm run test:e2e

# Integration tests (start API first)
node apps/api/src/server.js
npm run test:int

# Everything
npm test
```

### Test structure

| Suite | File | What it tests |
|-------|------|---------------|
| Unit | `question-validator.test.js` | All 14 quality rules, autoFix, edge cases |
| Unit | `csv-import.test.js` | CSV parser, valid/invalid fixtures |
| Unit | `storage.test.js` | CRUD lifecycle, pagination, filters |
| Integration | `api.test.js` | HTTP endpoints: create→update→delete, 404s, validation |
| E2E | `data-quality.test.js` | Live DB structural integrity, quality rules, grammar |
| E2E | `video.test.js` | MP4 file scan, magic bytes, size, cross-check |

### Reusable test libraries

| Library | API |
|---------|-----|
| `tests/lib/question-validator.js` | `validate(q)`, `validateAll(qs)`, `autoFix(q)`, `RULES` |
| `tests/lib/video-validator.js` | `validateVideoFile(path, opts?)`, `expectedDuration(cfg)` |
| `tests/lib/csv-loader.js` | `parseCsv(text)`, `loadFixture(filename)` |

---

## Repair Tool

Automatically fixes common question quality issues with a timestamped backup.

```powershell
# Dry run
node tests/repair/repair-questions.mjs --dry-run

# Apply fixes
npm run repair
```

**Auto-fixable:** lowercase first letter, missing terminal punctuation, double spaces  
**Manual fix required:** empty text/options, invalid `correctOption`, duplicate options

---

## Data Files

| Path | Contents |
|------|---------|
| `apps/api/data/quizforge.db` | SQLite database (questions, video_jobs, question_usage) |
| `apps/api/data/categories.json` | Category + subcategory list (seed/config) |
| `apps/api/data/question-banks/*.csv` | Bulk CSV files ready for import |
| `apps/api/public/videos/` | Rendered MP4 output |
| `apps/api/public/audio/<jobId>/` | Per-job TTS MP3 files |
| `apps/api/public/audio/shared/` | `tick.wav`, `ding.wav` |
| `apps/api/public/music/` | User-supplied background music MP3s |

---

## Known Limitations

- **Single render worker** — jobs are processed one at a time; queue is in-memory but recovers on restart via startup recovery.
- **Google TTS rate limits** — bulk audio generation may be throttled on very long question lists; the 320ms inter-chunk delay mitigates this.
- **Background music user-supplied** — QuizForge does not ship music files. Place royalty-free MP3s in `public/music/` with the exact filenames listed in [Background Music](#background-music).
- **No auth** — the API has no authentication; intended for local or trusted-network use only.
- **ffprobe optional** — video codec/fps/resolution checks in the test suite are skipped if ffprobe is not in PATH.
- **Remotion bundle cache** — the bundle is rebuilt on server restart; first render after restart takes ~30s longer.


---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Workspace Structure](#workspace-structure)
4. [Getting Started](#getting-started)
5. [Apps](#apps)
   - [API (`apps/api`)](#api-appsapi)
   - [Web Dashboard (`apps/web`)](#web-dashboard-appsweb)
   - [Renderer (`apps/renderer`)](#renderer-appsrenderer)
6. [REST API Reference](#rest-api-reference)
7. [Video Generation](#video-generation)
8. [Question Management](#question-management)
9. [CSV Import / Export](#csv-import--export)
10. [Visual Themes](#visual-themes)
11. [Test Suite](#test-suite)
12. [Repair Tool](#repair-tool)
13. [Data Files](#data-files)
14. [Known Limitations](#known-limitations)

---

## Project Overview

QuizForge automates the creation of engaging quiz videos for educational content, social media, and e-learning platforms. You supply a question bank (JSON or CSV), choose a category and visual theme, and QuizForge renders a fully animated 1920×1080 MP4 with:

- Animated question cards with staggered answer options
- Countdown timer ring per question
- Answer reveal at 65% of question time (correct option highlighted, others dimmed)
- 4 vibrant dark themes (neon, sunset, ocean, forest)
- Gradient progress bar with question dividers
- Animated background effects (grid, orbs, particles)
- Intro and outro sequences

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Web Dashboard  (React 18 + Vite 5 · port 5174)         │
│  Dashboard · Generate · Questions · Videos panels       │
└───────────────────┬─────────────────────────────────────┘
                    │ /api  proxy
┌───────────────────▼─────────────────────────────────────┐
│  REST API  (Express ESM · port 4001)                     │
│  server.js · storage.js · csv.js · worker.js            │
└───────────────────┬─────────────────────────────────────┘
                    │ renderMedia()
┌───────────────────▼─────────────────────────────────────┐
│  Renderer  (Remotion v4 · TypeScript + React)            │
│  QuizVideo · QuestionScene · AnswerOption · TimerRing   │
└─────────────────────────────────────────────────────────┘
```

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces |
| Dev runner | `concurrently` |
| API | Express 4, ESM (`"type":"module"`) |
| Storage | JSON flat-file (`data/*.json`) |
| Video engine | Remotion v4 (`@remotion/bundler`, `@remotion/renderer`) |
| UI | React 18, Vite 5, lucide-react |
| Testing | Node.js built-in `node:test` + `node:assert` |
| Node version | v24+ |

---

## Workspace Structure

```
QuizForge/
├── package.json                  # root workspace, scripts, "type":"module"
├── Readme1.md
│
├── apps/
│   ├── api/                      # Express REST API
│   │   ├── src/
│   │   │   ├── server.js         # route definitions
│   │   │   ├── storage.js        # JSON read/write with validation
│   │   │   ├── csv.js            # CSV import parser
│   │   │   └── worker.js         # Remotion render queue
│   │   ├── data/
│   │   │   ├── questions.json
│   │   │   ├── categories.json
│   │   │   ├── videos.json
│   │   │   └── question-usage.json
│   │   └── public/
│   │       └── videos/           # rendered MP4 output
│   │
│   ├── web/                      # React dashboard
│   │   ├── src/
│   │   │   ├── App.jsx           # all panels in one file
│   │   │   ├── main.jsx
│   │   │   └── styles.css
│   │   ├── index.html
│   │   └── vite.config.js        # proxies /api → localhost:4001
│   │
│   └── renderer/                 # Remotion compositions
│       └── src/
│           ├── Root.tsx           # registers composition
│           ├── QuizVideo.tsx      # sequences Intro→Questions→Outro
│           ├── types.ts           # shared TypeScript types
│           ├── themes.ts          # 4 theme configs
│           ├── scenes/
│           │   └── QuestionScene.tsx
│           └── components/
│               ├── AnswerOption.tsx
│               ├── TimerRing.tsx
│               ├── ProgressBar.tsx
│               └── BackgroundEffects.tsx
│
└── tests/
    ├── lib/
    │   ├── question-validator.js  # 14-rule reusable engine
    │   ├── video-validator.js     # MP4 file checks + ffprobe
    │   └── csv-loader.js         # pure CSV parser + loadFixture()
    ├── fixtures/
    │   ├── api-test-cases.csv
    │   ├── question-quality-rules.csv
    │   ├── question-accuracy.csv
    │   ├── sample-import.csv
    │   └── invalid-import.csv
    ├── unit/
    │   ├── question-validator.test.js
    │   ├── csv-import.test.js
    │   └── storage.test.js
    ├── integration/
    │   └── api.test.js           # requires API on port 4001
    ├── e2e/
    │   ├── data-quality.test.js
    │   └── video.test.js
    └── repair/
        └── repair-questions.mjs
```

---

## Getting Started

### Prerequisites

- Node.js v24+
- npm v10+
- (Optional) ffprobe in PATH for codec/resolution checks in video tests

### Install

```powershell
cd E:\QuizForge
npm install
```

### Run (both servers)

```powershell
npm run dev
```

Or individually:

```powershell
# API only (port 4001)
npm run dev:api

# Web only (port 5174)
npm run dev:web

# Remotion Studio (visual preview)
npm run studio
```

Open **http://localhost:5174** for the dashboard.

---

## Apps

### API (`apps/api`)

Express server with ESM modules, listening on **port 4001**. Data is persisted as JSON files under `apps/api/data/`.

**Start manually:**
```powershell
node "E:\QuizForge\apps\api\src\server.js"
```

**Modules:**

| File | Responsibility |
|------|---------------|
| `server.js` | Route definitions, error handling, static file serving |
| `storage.js` | `getQuestions`, `addQuestion`, `updateQuestion`, `deleteQuestion`, `getVideos`, `createVideoJob`, `updateVideoJob`, `deleteVideo`, `getUsedIds`, `markUsed` |
| `csv.js` | Parse CSV text → validate → bulk insert via `storage.addQuestions` |
| `worker.js` | Remotion `bundle()` → `renderMedia()` → save MP4 → update job status |

---

### Web Dashboard (`apps/web`)

Single-page React app with 4 panels:

| Panel | Features |
|-------|---------|
| **Dashboard** | Live stats (total questions, videos created, this month, rendering), recent activity feed |
| **Generate** | Category/subcategory selector, question count, seconds per question, theme picker, live preview card, queue button |
| **Questions** | Full question table with category filter (auto-populated), text search, inline edit, delete, CSV drag-and-drop import |
| **Videos** | Video list with status badges (queued/rendering/completed/failed), streaming playback, delete |

**Proxy:** All `/api/*` calls are forwarded to `http://localhost:4001` via `vite.config.js`.

---

### Renderer (`apps/renderer`)

Remotion compositions written in TypeScript + React. The composition is registered in `Root.tsx` with `calculateMetadata` for dynamic duration:

```
durationInFrames = 60 (intro) + questions.length × questionTime × 30fps + 90 (outro)
```

**Output:** 1920 × 1080 px, 30 fps, H.264 MP4.

---

## REST API Reference

Base URL: `http://localhost:4001`

### Health

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/health` | `{ ok: true, uptime, timestamp }` |

### Categories

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/categories` | `[{ name, subcategories[] }]` |

### Questions

| Method | Path | Body / Query | Response |
|--------|------|-------------|----------|
| `GET` | `/questions` | `?category=&subcategory=&limit=50&offset=0` | `{ items[], total }` |
| `POST` | `/questions` | Question object | `201 { id, ...question }` |
| `PUT` | `/questions/:id` | Partial question fields | `200 Updated question` |
| `DELETE` | `/questions/:id` | — | `200 { ok: true }` |
| `POST` | `/questions/csv` | `{ csv: "..." }` | `{ imported, skipped, errors[] }` |
| `GET` | `/csv-template` | — | CSV file download |

**Required fields for `POST /questions`:**
`category`, `subcategory`, `questionText`, `option1`, `option2`, `option3`, `option4`, `correctOption` (1–4)

### Videos

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/videos` | — | `[VideoJob]` |
| `POST` | `/videos/generate` | `{ category, subcategory?, questionCount?, questionTime?, theme?, avoidRepeat? }` | `{ jobId, status: "queued" }` |
| `DELETE` | `/videos/:id` | — | `200 { ok: true }` |

**Static files:** Rendered MP4s served from `/videos/<path>` (maps to `public/videos/`).

---

## Video Generation

1. `POST /videos/generate` creates a job record in `videos.json` with `status: "queued"`
2. `worker.js` picks it up immediately, calls Remotion `bundle()` (cached after first call)
3. Selects questions matching category/subcategory, shuffles, avoids recently used IDs
4. Calls `renderMedia()` — outputs to `public/videos/<category>/<subcategory>/video-<id>-<ts>-<rand>.mp4`
5. Updates job to `status: "completed"` with `filePath`

**Generation options:**

| Field | Default | Description |
|-------|---------|-------------|
| `questionCount` | 5 | Number of questions to include |
| `questionTime` | 10 | Seconds per question (affects video duration) |
| `theme` | `"neon"` | Visual theme (`neon` / `sunset` / `ocean` / `forest`) |
| `avoidRepeat` | `true` | Skip questions used in last 30 days |

---

## Question Management

Questions are stored in `apps/api/data/questions.json`. Each question object:

```json
{
  "id": 1,
  "category": "Science",
  "subcategory": "Physics",
  "questionText": "What is the speed of light?",
  "option1": "299,792,458 m/s",
  "option2": "150,000,000 m/s",
  "option3": "3,000,000 m/s",
  "option4": "1,080,000,000 m/s",
  "correctOption": 1,
  "difficulty": "medium",
  "imageUrl": "",
  "explanation": "The speed of light in a vacuum is exactly 299,792,458 metres per second.",
  "tags": ["physics", "constants"]
}
```

**Validation rules enforced by `storage.js`:**
- `questionText`, `option1–4`, `category`, `subcategory`, `correctOption` must be non-empty
- `correctOption` must be an integer 1–4

---

## CSV Import / Export

### Import format

```csv
category,subcategory,question,option1,option2,option3,option4,correct_option,difficulty,tags,image_url,explanation
Science,Physics,What force keeps planets in orbit?,Gravity,Magnetism,Nuclear force,Friction,1,easy,physics|solar system,,
```

- **Required columns:** `category`, `subcategory`, `question`, `option1`, `option2`, `option3`, `option4`, `correct_option`
- `correct_option` must be `1`, `2`, `3`, or `4`
- `question` must be at least 5 characters
- `tags` is pipe-separated (`physics|space`)
- Rows with errors are skipped; the response includes `errors[]` with line numbers

### Download template

```
GET http://localhost:4001/csv-template
```

### Drag-and-drop import

Drop a `.csv` file onto the **Questions** panel in the web dashboard to import in-browser.

---

## Visual Themes

| Theme | Background | Primary | Accent | Font |
|-------|-----------|---------|--------|------|
| `neon` | Deep dark purple | Purple | Pink | Orbitron / Exo 2 |
| `sunset` | Dark warm | Orange | Red | Rajdhani / Exo 2 |
| `ocean` | Dark navy | Blue | Cyan | Rajdhani / Exo 2 |
| `forest` | Dark green | Green | Teal | Rajdhani / Exo 2 |

Each theme defines: `background`, `primary`, `secondary`, `accent`, `text`, `textMuted`, `surface`, `badgeGradient`, `correctColor`, `correctGlow`, `progressGradient`, `timerColor`, `particleColor`, `gridColor`.

---

## Test Suite

**76 tests, 0 failures** across unit, integration, and E2E layers.

### Run tests

```powershell
# All non-integration tests (no server needed)
npm run test:unit
npm run test:e2e

# Integration tests (start API first)
node "E:\QuizForge\apps\api\src\server.js"
npm run test:int

# Everything
npm test
```

### Test structure

| Suite | File | What it tests |
|-------|------|---------------|
| Unit | `question-validator.test.js` | All 14 quality rules, autoFix, edge cases (38 tests) |
| Unit | `csv-import.test.js` | CSV parser, valid fixture, invalid fixture negative cases |
| Unit | `storage.test.js` | CRUD lifecycle, pagination, filters, error throws |
| Integration | `api.test.js` | HTTP endpoints: create→update→delete lifecycle, 404s, validation errors |
| E2E | `data-quality.test.js` | Live `questions.json` structural integrity, quality rules, accuracy spot-checks, grammar |
| E2E | `video.test.js` | MP4 file scan, magic bytes, size, `videos.json` cross-check, stuck-job detection |

### Reusable test libraries

| Library | API |
|---------|-----|
| `tests/lib/question-validator.js` | `validate(q)`, `validateAll(questions)`, `autoFix(q)`, `RULES` |
| `tests/lib/video-validator.js` | `validateVideoFile(path, opts?)`, `expectedDuration(cfg)` |
| `tests/lib/csv-loader.js` | `parseCsv(text)`, `loadFixture(filename)` |

### CSV-driven fixtures

| Fixture | Purpose |
|---------|---------|
| `question-quality-rules.csv` | 14 rule definitions (id, severity, field, check, auto_fixable) |
| `api-test-cases.csv` | 14 endpoint test cases (method, path, expected_status, checks) |
| `question-accuracy.csv` | Known-answer spot-checks (keyword → expected correct fragment) |
| `sample-import.csv` | 5 valid questions for positive import testing |
| `invalid-import.csv` | 5 invalid rows for negative import testing |

---

## Repair Tool

Automatically fixes common question quality issues and writes the repaired file with a timestamped backup.

```powershell
# Dry run — see what would be fixed without writing
node tests/repair/repair-questions.mjs --dry-run

# Apply fixes + write backup
npm run repair
```

**Auto-fixable issues:**
- Lowercase first letter → capitalised
- Missing terminal punctuation → appended `?`
- Double spaces → collapsed to single space

**Requires manual fix:**
- Empty `questionText` or options
- Invalid `correctOption` value
- Duplicate options

---

## Data Files

All data is stored as pretty-printed JSON in `apps/api/data/`:

| File | Contents |
|------|---------|
| `questions.json` | Array of question objects |
| `categories.json` | Array of `{ name, subcategories[] }` |
| `videos.json` | Array of video job records with status, filePath, error |
| `question-usage.json` | Per-category usage log for anti-repeat logic |

The `question-banks/` sub-folder can hold bulk CSV files ready for import.

---

## Known Limitations

- **Flat-file storage** — `questions.json` is read/written on every request; not suitable for > ~50,000 questions without migrating to SQLite or a real database.
- **Single render worker** — video jobs are processed one at a time; concurrent requests queue up in memory (lost on server restart).
- **No auth** — the API has no authentication; intended for local or trusted-network use only.
- **ffprobe optional** — video codec/fps/resolution checks in the test suite are skipped if ffprobe is not in PATH.
- **Remotion bundle cache** — the Remotion bundle is rebuilt if the server restarts. First render after restart takes longer (~30 s).
