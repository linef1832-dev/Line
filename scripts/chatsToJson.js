/**
 * CSV คอลัมน์ question,answer → JSON สำหรับ ingest
 * node scripts/chatsToJson.js --input chats.csv --output chats.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input") opts.input = args[++i];
  else if (args[i] === "--output") opts.output = args[++i];
  else if (args[i] === "--q-col") opts.qCol = args[++i];
  else if (args[i] === "--a-col") opts.aCol = args[++i];
}
opts.qCol = opts.qCol || "question";
opts.aCol = opts.aCol || "answer";

if (!opts.input || !opts.output) {
  console.error("Usage: node scripts/chatsToJson.js --input chats.csv --output chats.json");
  process.exit(1);
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const row = {};
    headers.forEach((h, j) => {
      row[h] = (parts[j] || "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

const raw = readFileSync(opts.input, "utf8");
const { rows } = parseCsv(raw);
const items = rows.map((row, i) => {
  const q = (row[opts.qCol] || "").trim();
  const a = (row[opts.aCol] || "").trim();
  return {
    text: `คำถาม: ${q}\nคำตอบอ้างอิง: ${a}`,
    source: "chat_history",
    row: i,
  };
});

writeFileSync(opts.output, JSON.stringify(items, null, 2), "utf8");
console.log("wrote", items.length, "->", opts.output);
