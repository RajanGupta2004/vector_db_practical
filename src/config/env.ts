import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),

  openaiApiKey: process.env.OPENAI_API_KEY || "",

  qdrantUrl:
    process.env.QDRANT_URL || "http://localhost:6333",

  qdrantCollection:
    process.env.QDRANT_COLLECTION || "knowledge_base",
};

