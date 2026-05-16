# cshse-ai

Python FastAPI microservice that powers the AI-assisted import wizard for the CSHSE Accreditation Self-Study Portal. Splits uploaded self-study documents into sections, embeds them, and uses Claude Haiku to recommend Standard/Specification tags + supporting-evidence classifications.

Lives alongside the Node CSHSE server in the `bubbly-solace` Railway project. Talks to a shared Qdrant vector DB. Service-to-service auth is HMAC-SHA256.

## Architecture

See [Engineering/legacy-self-study-import.md](../CSHSE/CSHSE/Engineering/legacy-self-study-import.md) and [Engineering/sprint-plan-2026-05-16.md](../CSHSE/CSHSE/Engineering/sprint-plan-2026-05-16.md) (Sprint 1) in the wiki.

## Local development

```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Environment variables (`.env` or shell):

| Var | Default | Notes |
|---|---|---|
| `CSHSE_ENV` | `dev` | `prod` or `dev` — drives Qdrant collection-name suffixes |
| `QDRANT_URL` | `http://qdrant.railway.internal:6333` | Single shared Qdrant instance in prod env |
| `QDRANT_API_KEY` | — | from Railway env vars |
| `ANTHROPIC_API_KEY` | — | Claude Haiku 4.5 for spec-matching adjudication |
| `OPENAI_API_KEY` | — | `text-embedding-3-small` for vectors |
| `NODE_SERVICE_HMAC_SECRET` | — | shared secret with the Node server |
| `CROSS_INSTITUTION_SEARCH_ENABLED` | `false` | gated by CSHSE board approval |
| `MONGO_URL` | — | read-only access to the CSHSE Mongo for spec text |

## Tests

```bash
pip install pytest
pytest -v
```

## Deploy

Railway service `cshse-ai` in the `bubbly-solace` project. Both prod and dev env instances share the Qdrant in the production env (collection-namespace isolation).

```bash
railway link --project bubbly-solace --environment production
railway service cshse-ai
railway up
```
