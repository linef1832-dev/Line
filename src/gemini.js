import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "./config.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export async function embedTexts(texts) {
  const model = genAI.getGenerativeModel({ model: config.geminiEmbeddingModel });
  const out = [];
  for (const t of texts) {
    const r = await model.embedContent(t);
    const values = r.embedding?.values;
    if (!values || !values.length) {
      throw new Error("Gemini embedContent returned empty embedding");
    }
    out.push(values);
  }
  return out;
}

export async function draftReply(userQuestion, contextSnippets) {
  const model = genAI.getGenerativeModel({
    model: config.geminiChatModel,
    systemInstruction: config.ragSystemPrompt,
  });
  const contextBlock =
    contextSnippets && contextSnippets.length
      ? contextSnippets.join("\n\n---\n\n")
      : "(ไม่มีบริบทจากฐานความรู้)";
  const prompt =
    `บริบทจากฐานความรู้:\n${contextBlock}\n\nคำถามลูกค้า:\n${userQuestion}`;
  const result = await model.generateContent(prompt);
  const text = result.response?.text?.() ?? "";
  return text.trim();
}
