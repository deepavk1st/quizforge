import { parse } from "csv-parse/sync";
import * as storage from "./storage.js";

const REQUIRED = [
  "category",
  "subcategory",
  "question",
  "option1",
  "option2",
  "option3",
  "option4",
  "correct_option",
];

export async function importCsv(text) {
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const errors = [];
  const valid = [];

  rows.forEach((row, i) => {
    const lineNum = i + 2;
    const missing = REQUIRED.filter((k) => !row[k]);
    if (missing.length > 0) {
      errors.push({ line: lineNum, message: `Missing: ${missing.join(", ")}` });
      return;
    }

    const questionText = row.question ? row.question.trim() : "";
    if (questionText.length < 5) {
      errors.push({ line: lineNum, message: `question text too short (< 5 chars): "${questionText}"` });
      return;
    }

    const correctOption = parseInt(row.correct_option, 10);
    if (![1, 2, 3, 4].includes(correctOption)) {
      errors.push({
        line: lineNum,
        message: `correct_option must be 1–4, got "${row.correct_option}"`,
      });
      return;
    }

    valid.push({
      category: row.category,
      subcategory: row.subcategory,
      questionText: row.question,
      option1: row.option1,
      option2: row.option2,
      option3: row.option3,
      option4: row.option4,
      correctOption,
      difficulty: row.difficulty || "medium",
      imageUrl: row.image_url || undefined,
      audioUrl: row.audio_url || undefined,
      explanation: row.explanation || undefined,
      tags: row.tags ? row.tags.split("|").map((t) => t.trim()) : [],
    });
  });

  const added = valid.length > 0 ? await storage.addQuestions(valid) : [];

  return {
    imported: added.length,
    skipped: errors.length,
    errors: errors.slice(0, 20),
  };
}
