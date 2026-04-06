# LINE + RAG (Supabase pgvector) + Gemini + แอดมิน Approve

Backend เขียนด้วย **Node.js (JavaScript)** ใช้ **Gemini API** สำหรับ embedding และร่างคำตอบ — **ไม่ใช้ OpenAI**

## ความปลอดภัยของ API Key

- ใส่ `GEMINI_API_KEY` ในไฟล์ **`.env`** เท่านั้น ห้าม commit ลง Git  
- **ถ้าเคยส่งคีย์ออกในแชทหรือที่สาธารณะ ให้ไป Google AI Studio แล้วหมุน/สร้างคีย์ใหม่ทันที**

## 1) Supabase + pgvector

1. เปิด extension **vector** (SQL: `create extension if not exists vector;`)
2. รัน `supabase/migrations/001_pgvector_knowledge.sql` ใน SQL Editor  
   - เวกเตอร์ตั้งเป็น **768 มิติ** ให้ตรงกับ `text-embedding-004` (ค่าเริ่มต้นของ Gemini API)  
   - ถ้าเคยใช้เวอร์ชันเก่า (1536 มิติ) ต้องลบตารางเดิมหรือปรับ schema ให้ตรงก่อน ingest ใหม่

## 2) ตั้งค่า LINE Messaging API

- ตั้ง Webhook เป็น `https://<โดเมน>/webhook/line` (HTTPS)
- เก็บ Channel secret และ Channel access token

## 3) ติดตั้งและรัน

```powershell
cd C:\Users\ADMIN_JUN88\Documents\rag-line-ai
npm install
copy .env.example .env
# แก้ .env ให้ครบ
npm start
```

หรือพัฒนาแบบ reload: `npm run dev`

## 4) Ingest ความรู้

```powershell
npm run ingest -- --input .\data\example.md --source "คู่มือ"
```

แปลง CSV แชท → JSON แล้ว ingest:

```powershell
node scripts/chatsToJson.js --input .\data\chats.csv --output .\data\chats.json
npm run ingest -- --input .\data\chats.json --source "ประวัติแชท"
```

## 5) แอดมิน

- Header: `Authorization: Bearer <ADMIN_API_KEY>`
- `GET /admin/pending`
- `POST /admin/approve/:id` — ส่งคำตอบไปลูกค้าด้วย LINE Push
- `POST /admin/reject/:id`

## โครงสร้าง

- `src/server.js` — Fastify, webhook LINE, API แอดมิน
- `src/gemini.js` — `embedContent`, `generateContent`
- `src/supabaseRest.js` — เรียก Supabase PostgREST (ไม่ใช้แพ็กเกจ supabase-js ก็ได้)
- `scripts/ingest.js` — อัปโหลด chunk เข้า `knowledge_chunks`

## หมายเหตุ

- ใช้ **SUPABASE_SERVICE_ROLE_KEY** เฉพาะบนเซิร์ฟเวอร์  
- โมเดลแชทปรับได้ด้วย `GEMINI_CHAT_MODEL` (เช่น `gemini-2.0-flash`)
