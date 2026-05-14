---
name: Overview
description: System synthesis of the CSHSE Accreditation Self-Study Portal — what it is, who uses it, and how its parts fit.
type: overview
tags: [overview]
last_reviewed: 2026-05-10
---

# CSHSE Accreditation Self-Study Portal

A web application for the **Council for Standards in Human Service Education (CSHSE)** that lets educational institutions prepare and submit accreditation self-studies, and lets reviewers evaluate them. Three program levels are supported: Associate (20 standards, 250 field-experience hours), Baccalaureate (21 standards, 350 hours), and Master's (18 standards).

## Personas

Four roles flow through the same UI, gated by [[frontend-architecture|client-side checks]] and server-side middleware:

- **Program Coordinator** — uploads legacy self-studies (DOCX/PDF), manually tags sections, edits narratives in [[frontend-architecture|TipTap]], manages evidence files, submits for review.
- **Reader / Reviewer** — assesses each specification for compliance (Y/N/NA), adds comments, bookmarks, flags.
- **Lead Reader** — compiles multi-reader assessments, resolves disagreements, sets final determinations.
- **Administrator / Superuser** — invites users, configures n8n webhooks, oversees submissions; superusers can impersonate any role via the `X-Impersonated-Role` header.

## Stack at a glance

- **Client:** React 18 + Vite + TipTap (rich text) + Tailwind + Radix UI + Zustand + TanStack Query.
- **Server:** Node 20 + Express 4 + Mongoose 8 + JWT/bcrypt + Multer + AWS S3.
- **Storage:** MongoDB (structured), [[storage-layer|GridFS]] (HTML up to 370MB+, images), AWS S3 (evidence files).
- **AI:** [[n8n-integration|five n8n workflows]] for narrative validation, document section matching, spec-PDF loading, RAG help chat, and help-doc upload. Supabase pgvector backs the RAG.
- **Deploy:** Railway PaaS, multi-stage Dockerfile, healthcheck on `/health`.

See [[system-architecture]] for the full architecture map.

## Where the complexity lives

1. **[[import-pipeline|Document import]]** — turns 370MB Word docs into navigable HTML, stores in GridFS, supports manual visual section tagging with table-aware splits and resumable extraction. The most intricate code in the repo.
2. **[[storage-layer|Hybrid storage]]** — three backends (MongoDB, GridFS, S3) with non-trivial fallback logic and known atomicity gaps in marker restore.
3. **[[n8n-integration|N8N webhooks]]** — outbound triggers + four unauthenticated public callback endpoints. Async validation state machine with no built-in retry or timeout.

## Read next

- [[index]] — full catalog
- [[CLAUDE]] — wiki schema
- [[security-audit-2026-05-10]] — current security findings
- [[incomplete-features-2026-05-10]] — current tech-debt inventory
- [[glossary]] — domain terms (CSHSE, standards, specifications, etc.)
