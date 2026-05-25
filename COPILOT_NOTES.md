# QuizForge — Copilot Session Notes

## Project Overview
AI-powered quiz video generator. Remotion renders trivia videos from a SQLite question bank.

## Stack
- **Monorepo**: npm workspaces — `apps/api`, `apps/web`, `apps/renderer`
- **API**: Express ESM, port **4001**, Node v24 built-in `node:sqlite` (DatabaseSync)
- **Web**: React + Vite, port **5174**, proxy `/api` → `localhost:4001`
- **Renderer**: Remotion v4 — `bundle()` + `renderMedia()` called from `worker.js`
- **DB**: SQLite at `apps/api/data/quizforge.db`

## Running the Project
```powershell
# API
node "E:\QuizForge\apps\api\src\server.js"

# Web (separate terminal)
Push-Location "E:\QuizForge\apps\web"; npx vite --port 5174

# Seed DB (first time or --reset)
node apps/api/scripts/seed-db.mjs [--reset]
```

## Key File Locations
| File | Purpose |
|------|---------|
| `apps/api/src/server.js` | Express API, port 4001 |
| `apps/api/src/storage.js` | All SQLite data access |
| `apps/api/src/worker.js` | In-memory render queue + Remotion calls |
| `apps/api/src/db.js` | DatabaseSync singleton + schema creation |
| `apps/api/data/quizforge.db` | SQLite database |
| `apps/api/data/question-banks/` | 6 CSV question bank files |
| `apps/api/scripts/seed-db.mjs` | Seeds DB from CSVs |
| `apps/api/public/videos/` | Rendered MP4 output |

## Database Schema (3 tables)
- **`questions`**: id, category, subcategory, question_text, option1–4, correct_option, difficulty, image_url, explanation, tags, source_csv, used_count, last_used_at, created_at
- **`video_jobs`**: id, category, subcategory, theme, question_count, question_time, avoid_days, reveal_answer, status, file_path, public_url, error, question_ids, created_at, completed_at
- **`question_video_map`**: id, question_id (FK→questions CASCADE), video_id (FK→video_jobs CASCADE), used_at — UNIQUE(question_id, video_id)

## CRITICAL: node:sqlite Quirks
- Uses **`node:sqlite`** built-in (Node v24) — NOT `better-sqlite3`
- `import { DatabaseSync } from "node:sqlite"`
- **NO `.transaction()` method** — use manual `db.exec("BEGIN TRANSACTION")` / `db.exec("COMMIT")` / `db.exec("ROLLBACK")` in try/catch
- API is synchronous despite `async` keyword on storage functions (for interface compatibility)

## Question Banks (120 questions, 20 each)
Located in `apps/api/data/question-banks/`:
- `science.csv` — Physics×5, Chemistry×5, Biology×5, Astronomy×5
- `history.csv` — Ancient×5, Medieval×5, Modern×6, American×4
- `geography.csv` — World×7, Europe×5, Asia×5, Americas×3
- `movies.csv` — BoxOffice×5, Directors×6, Actors×5, Genres×4
- `sports.csv` — Football×5, Basketball×5, Tennis×5, Olympics×5
- `technology.csv` — AI×5, Programming×5, Gadgets×5, Internet×5

CSV format: `category,subcategory,question,option1,option2,option3,option4,correct_option,difficulty,tags,image_url,explanation,status,last_used_at,video_ids`

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + stats |
| GET | `/stats` | Question usage stats |
| GET | `/questions` | List questions (`?status=unused&category=X`) |
| POST | `/questions` | Add question |
| PUT | `/questions/:id` | Update question |
| DELETE | `/questions/:id` | Delete question |
| POST | `/questions/csv` | Bulk import CSV |
| GET | `/questions/export` | Download questions as CSV |
| GET | `/csv-template` | Download blank CSV template |
| GET | `/videos` | List video jobs |
| POST | `/videos/generate` | Queue new video render |
| DELETE | `/videos/:id` | Delete video job |

## Video Generation Request Body
```json
{
  "category": "Science",
  "subcategory": "Physics",
  "questionCount": 5,
  "theme": "neon",
  "questionTime": 10,
  "revealAnswer": true,
  "avoidDays": 30
}
```
Themes: `neon`, `sunset`, `ocean`, `forest`

## Known Bugs Fixed (Session 4)
1. **processNext crash**: Wrapped `updateVideoJob("failed")` in its own try/catch so a missing job ID doesn't crash the server.
2. **Stale 'rendering' jobs**: On server startup, `storage.recoverStaleJobs()` resets `status='rendering'` → `'queued'` and re-enqueues them.

## Worker Behavior
- In-memory queue array; `enqueueJob(id)` pushes and starts `processNext()` if not running
- On startup: calls `storage.recoverStaleJobs()` → re-enqueues any interrupted renders
- Render output path: `apps/api/public/videos/<catSlug>/<subcatSlug>/video-<id>-<ts>-<slug>.mp4`
- Public URL served as static: `/videos/<catSlug>/<subcatSlug>/video-<id>-<ts>-<slug>.mp4`

## Storage.js Key Exports
`getCategories()`, `getQuestions({category, subcategory, status, limit, offset})`, `addQuestion(data)`, `addQuestions(items)`, `updateQuestion(id, data)`, `deleteQuestion(id)`, `getVideos()`, `createVideoJob(config)`, `updateVideoJob(id, updates)`, `deleteVideo(id)`, `getUsedIds(category, subcategory, avoidDays)`, `markUsed(category, subcategory, ids, videoId)`, `getStats()`, `recoverStaleJobs()`

## Session History
- **Session 3**: Scaffolded project, built Remotion renderer, 4 themes, all 76 tests passing
- **Session 4**: SQLite migration (db.js, rewrote storage.js), worker.js + server.js updated, 6 CSV banks created, seed-db.mjs built and run (120q inserted), Physics video rendered successfully, fixed server crash bugs
