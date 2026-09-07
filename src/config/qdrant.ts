import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "./env";

export const qdrantClient = new QdrantClient({
  url: env.qdrantUrl,
});