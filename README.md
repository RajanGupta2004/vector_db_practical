Yes. Since you have **Node.js experience**, let's build this as a real backend project rather than a toy example.

We'll use:

* **Node.js + TypeScript**
* **Express**
* **Qdrant** as the Vector Database
* **OpenAI embeddings**
* **Docker** for Qdrant
* REST APIs for document insertion and semantic search

The project will teach you the actual flow:

```text
Document
   ↓
Text
   ↓
Embedding Model
   ↓
Vector
   ↓
Qdrant
   ↓
Similarity Search
   ↓
Relevant Documents
```

## 1. Project Structure

```text
vector-db-practical/
│
├── src/
│   │
│   ├── config/
│   │   ├── env.ts
│   │   └── qdrant.ts
│   │
│   ├── controllers/
│   │   └── vector.controller.ts
│   │
│   ├── routes/
│   │   └── vector.routes.ts
│   │
│   ├── services/
│   │   ├── embedding.service.ts
│   │   └── vector.service.ts
│   │
│   ├── types/
│   │   └── vector.types.ts
│   │
│   ├── utils/
│   │   └── chunk.util.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── data/
│   └── documents/
│       ├── aws.txt
│       ├── kubernetes.txt
│       └── networking.txt
│
├── scripts/
│   └── seed.ts
│
├── docker/
│   └── docker-compose.yml
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

# 2. Initialize Project

```bash
mkdir vector-db-practical

cd vector-db-practical

npm init -y
```

Install dependencies:

```bash
npm install express dotenv openai @qdrant/js-client-rest
```

Development dependencies:

```bash
npm install -D typescript ts-node-dev @types/node @types/express
```

Initialize TypeScript:

```bash
npx tsc --init
```

---

# 3. package.json

Update your scripts:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "seed": "ts-node-dev --transpile-only scripts/seed.ts"
  }
}
```

---

# 4. TypeScript Configuration

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": [
    "src/**/*.ts",
    "scripts/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

---

# 5. Docker — Qdrant

Create:

```text
docker/docker-compose.yml
```

Put:

```yaml
services:

  qdrant:
    image: qdrant/qdrant:latest

    container_name: vector-db-qdrant

    ports:
      - "6333:6333"
      - "6334:6334"

    volumes:
      - qdrant_storage:/qdrant/storage

volumes:
  qdrant_storage:
```

Start Qdrant:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Check:

```bash
docker ps
```

You should see:

```text
vector-db-qdrant
```

---

# 6. Environment Variables

`.env.example`

```env
PORT=3000

OPENAI_API_KEY=your_openai_api_key

QDRANT_URL=http://localhost:6333

QDRANT_COLLECTION=knowledge_base
```

Copy it:

```bash
cp .env.example .env
```

On Windows:

```powershell
copy .env.example .env
```

Then add your API key.

---

# 7. Environment Configuration

`src/config/env.ts`

```typescript
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
```

---

# 8. Qdrant Client

`src/config/qdrant.ts`

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "./env";

export const qdrantClient = new QdrantClient({
  url: env.qdrantUrl,
});
```

Now your Node.js application can communicate with Qdrant.

---

# 9. Embedding Service

Create:

```text
src/services/embedding.service.ts
```

```typescript
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
```

This is a very important piece.

For example:

```text
"How does an AWS load balancer work?"
```

becomes:

```text
[0.023, -0.182, 0.493, ...]
```

That vector is what we'll store in Qdrant.

---

# 10. Vector Types

`src/types/vector.types.ts`

```typescript
export interface DocumentPayload {
  id: string;
  text: string;
  source: string;
  category?: string;
  createdAt: string;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  category?: string;
}
```

---

# 11. Chunk Utility

Later, when we build RAG, chunking will become very important.

For now create:

`src/utils/chunk.util.ts`

```typescript
export function chunkText(
  text: string,
  chunkSize = 500
): string[] {

  const words = text.split(/\s+/);

  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize) {

    const chunk = words
      .slice(i, i + chunkSize)
      .join(" ");

    if (chunk.trim()) {
      chunks.push(chunk);
    }
  }

  return chunks;
}
```

For example:

```text
1000 words
```

becomes:

```text
Chunk 1 → words 1-500
Chunk 2 → words 501-1000
```

---

# 12. Vector Service

This is the heart of the application.

`src/services/vector.service.ts`

```typescript
import { qdrantClient } from "../config/qdrant";
import { env } from "../config/env";
import { generateEmbedding } from "./embedding.service";

const VECTOR_SIZE = 1536;

export async function createCollection() {

  const collections =
    await qdrantClient.getCollections();

  const exists = collections.collections.some(
    collection =>
      collection.name === env.qdrantCollection
  );

  if (exists) {
    console.log("Collection already exists");

    return;
  }

  await qdrantClient.createCollection(
    env.qdrantCollection,
    {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    }
  );

  console.log(
    `Created collection: ${env.qdrantCollection}`
  );
}
```

---

# 13. Insert Vector

Add this to the same file:

```typescript
export async function insertDocument(
  id: string,
  text: string,
  source: string,
  category?: string
) {

  const embedding =
    await generateEmbedding(text);

  await qdrantClient.upsert(
    env.qdrantCollection,
    {
      wait: true,

      points: [
        {
          id,
          vector: embedding,

          payload: {
            text,
            source,
            category,
            createdAt:
              new Date().toISOString(),
          },
        },
      ],
    }
  );

  return {
    id,
    message: "Document stored successfully",
  };
}
```

---

# 14. Semantic Search

Now add:

```typescript
export async function searchDocuments(
  query: string,
  limit = 5
) {

  const queryEmbedding =
    await generateEmbedding(query);

  const results =
    await qdrantClient.search(
      env.qdrantCollection,
      {
        vector: queryEmbedding,

        limit,

        with_payload: true,
      }
    );

  return results;
}
```

This is the important operation:

```text
User Query
    ↓
Embedding
    ↓
Vector
    ↓
Qdrant
    ↓
Similarity Search
    ↓
Top K Results
```

---

# 15. Controller

`src/controllers/vector.controller.ts`

```typescript
import { Request, Response } from "express";

import {
  insertDocument,
  searchDocuments,
} from "../services/vector.service";

export async function addDocument(
  req: Request,
  res: Response
) {

  try {

    const {
      id,
      text,
      source,
      category,
    } = req.body;

    if (!id || !text || !source) {

      return res.status(400).json({
        message:
          "id, text and source are required",
      });

    }

    const result =
      await insertDocument(
        id,
        text,
        source,
        category
      );

    return res.status(201).json(result);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      message: "Failed to insert document",
    });
  }
}
```

Search controller:

```typescript
export async function search(
  req: Request,
  res: Response
) {

  try {

    const query =
      req.query.query as string;

    const limit =
      Number(req.query.limit || 5);

    if (!query) {

      return res.status(400).json({
        message: "query is required",
      });

    }

    const results =
      await searchDocuments(
        query,
        limit
      );

    return res.json({
      query,
      results,
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      message: "Search failed",
    });
  }
}
```

---

# 16. Routes

`src/routes/vector.routes.ts`

```typescript
import { Router } from "express";

import {
  addDocument,
  search,
} from "../controllers/vector.controller";

const router = Router();

router.post(
  "/documents",
  addDocument
);

router.get(
  "/search",
  search
);

export default router;
```

---

# 17. Express Application

`src/app.ts`

```typescript
import express from "express";

import vectorRoutes from "./routes/vector.routes";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
  });

});

app.use(
  "/api/v1/vector",
  vectorRoutes
);

export default app;
```

---

# 18. Server

`src/server.ts`

```typescript
import app from "./app";

import { env } from "./config/env";

import {
  createCollection,
} from "./services/vector.service";

async function startServer() {

  try {

    await createCollection();

    app.listen(
      env.port,
      () => {

        console.log(
          `Server running on port ${env.port}`
        );

      }
    );

  } catch (error) {

    console.error(
      "Failed to start server",
      error
    );

    process.exit(1);
  }
}

startServer();
```

---

# 19. Add Sample Documents

Create:

```text
data/documents/aws.txt
```

```text
AWS EC2 is a virtual server service provided by Amazon Web Services.
EC2 instances can be used to host applications, APIs, websites and backend services.
Security groups control inbound and outbound network traffic for EC2 instances.
```

Create:

```text
data/documents/networking.txt
```

```text
An AWS load balancer distributes incoming traffic across multiple servers.
Application Load Balancer works at the HTTP and HTTPS layer.
Network Load Balancer is designed for high performance TCP and UDP traffic.
```

Create:

```text
data/documents/kubernetes.txt
```

```text
Kubernetes is a container orchestration platform.
It manages containers, deployments, services and scaling.
Kubernetes can automatically restart failed containers and distribute workloads.
```

---

# 20. Seed Script

`scripts/seed.ts`

```typescript
import fs from "fs";
import path from "path";

import {
  createCollection,
  insertDocument,
} from "../src/services/vector.service";

async function seed() {

  await createCollection();

  const directory =
    path.join(
      process.cwd(),
      "data",
      "documents"
    );

  const files =
    fs.readdirSync(directory);

  for (const file of files) {

    const filePath =
      path.join(directory, file);

    const text =
      fs.readFileSync(
        filePath,
        "utf-8"
      );

    const id =
      file.replace(".txt", "");

    await insertDocument(
      id,
      text,
      file
    );

    console.log(
      `Inserted: ${file}`
    );
  }

  console.log(
    "Database seeding completed"
  );
}

seed();
```

---

# 21. Start the Application

First start Qdrant:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Then:

```bash
npm run dev
```

You should get something like:

```text
Created collection: knowledge_base

Server running on port 3000
```

---

# 22. Seed the Vector Database

Open another terminal:

```bash
npm run seed
```

Expected:

```text
Inserted: aws.txt
Inserted: kubernetes.txt
Inserted: networking.txt

Database seeding completed
```

Now your vector database contains embeddings.

---

# 23. Test Semantic Search

Use Postman.

### GET

```text
http://localhost:3000/api/v1/vector/search?query=How%20does%20AWS%20distribute%20traffic
```

You should get something conceptually like:

```json
{
  "query": "How does AWS distribute traffic",
  "results": [
    {
      "id": "networking",
      "score": 0.89,
      "payload": {
        "text": "An AWS load balancer distributes incoming traffic...",
        "source": "networking.txt"
      }
    }
  ]
}
```

Notice something important.

The query:

```text
How does AWS distribute traffic?
```

doesn't necessarily exactly match:

```text
An AWS load balancer distributes incoming traffic across multiple servers.
```

Yet the vector database understands that they are semantically related.

**That's the core concept you need to understand.**

---

# 24. Test Another Query

Try:

```text
http://localhost:3000/api/v1/vector/search?query=How%20can%20I%20run%20my%20backend%20on%20AWS
```

Expected top result:

```text
aws.txt
```

Try:

```text
http://localhost:3000/api/v1/vector/search?query=What%20system%20manages%20containers
```

Expected:

```text
kubernetes.txt
```

---

# 25. What You Have Built

At this point:

```text
                         USER
                          │
                          │
                     Search Query
                          │
                          ↓
                   Node.js API
                          │
                          ↓
                  Embedding Model
                          │
                          ↓
                    Query Vector
                          │
                          ↓
                    ┌───────────┐
                    │  Qdrant   │
                    │           │
                    │ Vectors   │
                    │ Metadata  │
                    └─────┬─────┘
                          │
                    Similarity
                       Search
                          │
                          ↓
                  Top K Documents
```

---

# 26. But We Are Not Finished Yet

This is **Level 1**.

For your Atlas project, I want you to eventually turn this into:

```text
                 VECTOR DATABASE
                        │
       ┌────────────────┼────────────────┐
       ↓                ↓                ↓
   Embeddings       Metadata        Similarity
       │                │                │
       ↓                ↓                ↓
   Documents       Filtering         Top-K
                                        │
                                        ↓
                                  Hybrid Search
                                        │
                                        ↓
                                    Reranking
```

Then we'll build:

```text
                LEVEL 2
                   │
                   ↓
                  RAG
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
  Document Ingestion      Query Pipeline
        │                     │
        ↓                     ↓
     Chunking              Retrieval
        │                     │
        ↓                     ↓
    Embeddings             Context
        │                     │
        └──────────┬──────────┘
                   ↓
                  LLM
```

And finally:

```text
                LEVEL 3
               AI AGENT
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
       RAG      Memory       Tools
        │          │          │
        └──────────┼──────────┘
                   ↓
                  LLM
                   ↓
                Response
```

## Your practical roadmap

I recommend you **do not jump directly to RAG**. Build this project in these steps:

**Step 1:** Basic Qdrant CRUD
**Step 2:** Embeddings
**Step 3:** Semantic search
**Step 4:** Metadata filtering
**Step 5:** Chunking
**Step 6:** Top-K retrieval
**Step 7:** Hybrid search
**Step 8:** Reranking
**Step 9:** Multi-tenant vector search
**Step 10:** Convert it into a complete RAG system

That will give you the foundation needed for the **Atlas AI Agent Studio knowledge layer**, rather than just knowing how to call a vector database API.
