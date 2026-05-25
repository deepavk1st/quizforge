/**
 * csv-loader.js
 * Parses a CSV file into an array of plain objects.
 * Handles quoted fields, escaped quotes, empty values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parse CSV text → array of objects (first row = header keys).
 */
export function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const headers = splitRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitRow(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (cells[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return rows;
}

/** Split a single CSV row respecting quoted fields. */
function splitRow(row) {
  const cells = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      cells.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** Load a CSV fixture file by name (from tests/fixtures/). */
export function loadFixture(filename) {
  const fixturePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../fixtures",
    filename
  );
  const text = fs.readFileSync(fixturePath, "utf-8");
  return parseCsv(text);
}
