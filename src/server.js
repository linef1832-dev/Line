import Fastify from "fastify";
import { config } from "./config.js";
import { verifyLineSignature } from "./lineSignature.js";
import { embedTexts, draftReply } from "./gemini.js";
import * as sb from "./supabaseRest.js";

const fastify = Fastify({ logger: true });

fastify.removeAllContentTypeParsers();
fastify.addContentTypeParser("application/json", { parseAs: "buffer" }, async (request, body) => {
  request.rawBody = body;
  return JSON.parse(body.toString("utf8"));
});

function authAdmin(authHeader) {
  const expected = `Bearer ${config.adminApiKey}`;
  return authHeader === expected;
}

async function linePushText(toUserId, text) {
  const url = "https://api.line.me/v2/bot/message/push";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.lineChannelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: toUserId,
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LINE push failed: ${res.status} ${t}`);
  }
}

async function lineReplyText(replyToken, text) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.lineChannelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    fastify.log.error({ status: res.status, body: t }, "LINE reply failed");
  }
}

fastify.get("/health", async () => ({ status: "ok" }));

fastify.post("/webhook/line", async (request, reply) => {
  const sig = request.headers["x-line-signature"];
  const raw = request.rawBody;
  if (!raw || !verifyLineSignature(raw, config.lineChannelSecret, sig)) {
    return reply.code(401).send({ error: "Invalid signature" });
  }

  const payload = request.body;
  const events = payload?.events ?? [];

  for (const ev of events) {
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const userId = ev.source?.userId;
    const replyToken = ev.replyToken;
    const text = ev.message?.text ?? "";
    if (!userId || !replyToken || !String(text).trim()) continue;

    const q = String(text).trim();
    const [qEmb] = await embedTexts([q]);
    const rows = await sb.rpcMatchKnowledge(qEmb);
    const snippets = rows.map((r) => r.content).filter(Boolean);
    const answer = await draftReply(q, snippets);

    await sb.insertPending({
      line_user_id: userId,
      question_text: q,
      draft_text: answer,
      context_snippets: rows,
      status: "pending",
    });

    const ack =
      "รับคำถามแล้วค่ะ\n" +
      "ทีมงานกำลังตรวจคำตอบที่ AI ร่างไว้ — เมื่อแอดมินกดยืนยันจึงจะส่งถึงคุณ";
    await lineReplyText(replyToken, ack);
  }

  return reply.code(200).send();
});

fastify.get("/admin/pending", async (request, reply) => {
  if (!authAdmin(request.headers.authorization)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const items = await sb.listPending(50);
  return { items };
});

fastify.post("/admin/approve/:id", async (request, reply) => {
  if (!authAdmin(request.headers.authorization)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const id = request.params.id;
  const row = await sb.getPendingById(id);
  if (!row) return reply.code(404).send({ error: "Not found" });
  if (row.status !== "pending") {
    return reply.code(400).send({ error: "Not pending" });
  }
  await linePushText(row.line_user_id, row.draft_text);
  await sb.updatePendingStatus(id, "sent");
  return { ok: true, status: "sent" };
});

fastify.post("/admin/reject/:id", async (request, reply) => {
  if (!authAdmin(request.headers.authorization)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const id = request.params.id;
  await sb.updatePendingStatus(id, "rejected");
  return { ok: true, status: "rejected" };
});

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "0.0.0.0";

try {
  await fastify.listen({ port, host });
  fastify.log.info(`listening on ${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
