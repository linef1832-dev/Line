/**
 * Ingest คู่มือ / ประวัติแชท → Gemini embeddings → Supabase knowledge_chunks
 *
 * ต้องมีใน .env: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (ไม่จำเป็นต้องมี LINE / ADMIN สำหรับสคริปต์นี้)
 *
 * รัน: npm run ingest -- --input ./data/example.md --source คู่มือ
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

function req(name) {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`Missing env ${name}`);
  return v.trim();
}

function chunkText(text, maxChars = 1200, overlap = 150) {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const chunks = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + maxChars, t.length);
    chunks.push(t.slice(start, end).trim());
    if (end >= t.length) break;
    start = end - overlap;
  }
  return chunks.filter(Boolean);
}

function parseArgs() {
  const a = process.argv.slice(2);
  const out = { input: null, source: "ingest", batch: 32 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--input") out.input = a[++i];
    else if (a[i] === "--source") out.source = a[++i];
    else if (a[i] === "--batch") out.batch = Number(a[++i]) || 32;
  }
  if (!out.input) {
    console.error("Usage: npm run ingest -- --input <file.md|txt|json> [--source label] [--batch 32]");
    process.exit(1);
  }
  return out;
}

function loadItems(filePath, sourceLabel) {
  const raw = readFileSync(filePath, "utf8");
  const lower = filePath.toLowerCase();
  const items = [];

  if (lower.endsWith(".json")) {
    let data = JSON.parse(raw);
    if (data && typeof data === "object" && !Array.isArray(data) && data.items) {
      data = data.items;
    }
    if (!Array.isArray(data)) throw new Error("JSON ต้องเป็น array หรือมี key items");
    data.forEach((row, i) => {
      if (typeof row === "string") {
        items.push({ text: row, metadata: { source: sourceLabel, index: i } });
      } else if (row && typeof row === "object") {
        const t = row.text || row.content || "";
        const metadata = { ...row };
        delete metadata.text;
        delete metadata.content;
        metadata.source = metadata.source || sourceLabel;
        metadata.index = metadata.index ?? i;
        if (t) items.push({ text: t, metadata });
      }
    });
  } else {
    chunkText(raw).forEach((c, i) => {
      items.push({
        text: c,
        metadata: { source: sourceLabel, index: i, file: filePath.split(/[/\\]/).pop() },
      });
    });
  }
  return items;
}

async function restInsertChunks(baseUrl, key, rows) {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/knowledge_chunks`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${t}`);
  }
}

async function main() {
  const { input, source, batch } = parseArgs();
  const geminiKey = req("GEMINI_API_KEY");
  const supabaseUrl = req("SUPABASE_URL");
  const supabaseKey = req("SUPABASE_SERVICE_ROLE_KEY");
  const embedModel = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

  const items = loadItems(input, source);
  if (!items.length) {
    console.log("ไม่มีข้อมูล");
    return;
  }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: embedModel });

  let total = 0;
  for (let i = 0; i < items.length; i += batch) {
    const slice = items.slice(i, i + batch);
    const rowsOut = [];
    for (const it of slice) {
      const r = await model.embedContent(it.text);
      const values = r.embedding?.values;
      if (!values?.length) throw new Error("empty embedding");
      rowsOut.push({
        content: it.text,
        metadata: it.metadata,
        embedding: values,
      });
    }
    await restInsertChunks(supabaseUrl, supabaseKey, rowsOut);
    total += rowsOut.length;
    console.log(`inserted ${total} / ${items.length}`);
  }
  console.log("done:", total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
