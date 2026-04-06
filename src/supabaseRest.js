import { config } from "./config.js";

const headers = () => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
});

export async function rpcMatchKnowledge(queryEmbedding) {
  const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/match_knowledge_chunks`;
  const body = {
    query_embedding: queryEmbedding,
    match_count: config.ragMatchCount,
    min_similarity: config.ragMinSimilarity,
  };
  const res = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase RPC failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function insertPending(row) {
  const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/pending_line_replies`;
  const h = { ...headers(), Prefer: "return=representation" };
  const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(row) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function insertKnowledgeChunks(rows) {
  const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/knowledge_chunks`;
  const h = { ...headers(), Prefer: "return=minimal" };
  const res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(rows) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${t}`);
  }
}

export async function listPending(limit = 50) {
  const base = config.supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    select: "*",
    status: "eq.pending",
    order: "created_at.desc",
    limit: String(limit),
  });
  const url = `${base}/rest/v1/pending_line_replies?${params.toString()}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase select failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getPendingById(id) {
  const base = config.supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" });
  const url = `${base}/rest/v1/pending_line_replies?${params.toString()}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase select failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  if (Array.isArray(data) && data[0]) return data[0];
  return null;
}

export async function updatePendingStatus(id, status) {
  const base = config.supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ id: `eq.${id}` });
  const url = `${base}/rest/v1/pending_line_replies?${params.toString()}`;
  const h = { ...headers(), Prefer: "return=minimal" };
  const res = await fetch(url, { method: "PATCH", headers: h, body: JSON.stringify({ status }) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase update failed: ${res.status} ${t}`);
  }
}
