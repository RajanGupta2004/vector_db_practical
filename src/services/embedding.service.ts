import OpenAI from "openai";
import { env } from "../config/env";

const openai = new OpenAI({
  apiKey: env.openaiApiKey,
});

export async function generateEmbedding(
  text: string
): Promise<number[]> {

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return response.data[0].embedding;
}
