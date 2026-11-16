#!/usr/bin/env bash
# 고정 예제: NestJS + Prisma 프로젝트 + comments 리소스 OpenAPI
set -euo pipefail
cat > package.json <<'JSON'
{ "name": "eval-be", "private": true,
  "dependencies": { "@nestjs/core": "^11.0.0", "@nestjs/common": "^11.0.0", "@prisma/client": "^6.0.0", "class-validator": "^0.14.0" },
  "devDependencies": { "prisma": "^6.0.0", "jest": "^29.0.0", "supertest": "^7.0.0", "@testcontainers/postgresql": "^10.0.0", "typescript": "^5.6.0" } }
JSON
mkdir -p docs/api prisma
cat > prisma/schema.prisma <<'PRISMA'
datasource db { provider = "postgresql" url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }
model User { id Int @id @default(autoincrement()) email String @unique comments Comment[] }
model Post { id Int @id @default(autoincrement()) title String comments Comment[] }
model Comment { id Int @id @default(autoincrement()) body String authorId Int postId Int createdAt DateTime @default(now())
  author User @relation(fields: [authorId], references: [id]) post Post @relation(fields: [postId], references: [id]) }
PRISMA
cat > docs/api/comments.yaml <<'YAML'
openapi: 3.0.3
info: { title: comments, version: 1.0.0 }
components:
  securitySchemes: { bearer: { type: http, scheme: bearer } }
  schemas:
    Comment: { type: object, required: [id, body, authorId, postId, createdAt],
      properties: { id: { type: integer }, body: { type: string }, authorId: { type: integer }, postId: { type: integer }, createdAt: { type: string, format: date-time } } }
    CommentInput: { type: object, required: [body], properties: { body: { type: string, minLength: 1, maxLength: 500 } } }
paths:
  /posts/{postId}/comments:
    parameters: [{ name: postId, in: path, required: true, schema: { type: integer } }]
    get:
      responses: { "200": { description: ok, content: { application/json: { schema: { type: array, items: { $ref: "#/components/schemas/Comment" } } } } }, "404": { description: post not found } }
    post:
      security: [{ bearer: [] }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/CommentInput" } } } }
      responses: { "201": { description: created }, "400": { description: invalid }, "401": { description: unauthenticated }, "404": { description: post not found } }
  /comments/{id}:
    parameters: [{ name: id, in: path, required: true, schema: { type: integer } }]
    patch:
      security: [{ bearer: [] }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/CommentInput" } } } }
      responses: { "200": { description: ok }, "403": { description: not the author }, "404": { description: not found } }
    delete:
      security: [{ bearer: [] }]
      responses: { "204": { description: deleted }, "403": { description: not the author }, "404": { description: not found } }
YAML
