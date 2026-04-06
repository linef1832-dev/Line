import "dotenv/config";

function req(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

export const config = {
  geminiApiKey: req("GEMINI_API_KEY"),
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
  geminiChatModel: process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash",

  supabaseUrl: req("SUPABASE_URL"),
  supabaseServiceRoleKey: req("SUPABASE_SERVICE_ROLE_KEY"),

  lineChannelSecret: req("LINE_CHANNEL_SECRET"),
  lineChannelAccessToken: req("LINE_CHANNEL_ACCESS_TOKEN"),

  adminApiKey: req("ADMIN_API_KEY"),

  ragMatchCount: Number(process.env.RAG_MATCH_COUNT || 8),
  ragMinSimilarity: Number(process.env.RAG_MIN_SIMILARITY || 0.22),

  ragSystemPrompt:
    process.env.RAG_SYSTEM_PROMPT ||
    [
      "คุณเป็นผู้ช่วยตอบลูกค้าของบริษัท ใช้เฉพาะข้อมูลจากบริบทที่ให้มา",
      "ห้ามแต่งเรื่องหรือสัญญาสิ่งที่ไม่มีในบริบท ถ้าข้อมูลไม่พอให้บอกว่าต้องสอบถามแอดมิน",
      "ตอบเป็นภาษาไทยสุภาพ กระชับ",
    ].join(" "),
};
