---
name: Railway Deployment Topology
description: Two-environment Railway deployment for CSHSE — production tracks main, develop tracks developer; isolated MongoDBs, shared S3 bucket.
type: concept
tags: [deployment, railway, ops, mongodb, s3]
last_reviewed: 2026-05-16
---

# Railway Deployment Topology

CSHSE runs in the **`bubbly-solace`** Railway project. Two environments, each with its own CSHSE service instance, its own MongoDB, but a **shared Tigris S3 bucket** so document storage is unified.

## Topology — at a glance

| Environment | Branch | Public DNS | MongoDB | S3 bucket |
|---|---|---|---|---|
| `production` | `main` | `cshse.courseworx.media` | `MongoDB` (prod-only volume) | `cshse-filestorage-qlyj5pn` (shared) |
| `develop` | `developer` | `cshse-develop.up.railway.app` | `MongoDB` instance in develop env (fresh volume) | `cshse-filestorage-qlyj5pn` (shared, same as prod) |
| `evaluation` | `main` | (legacy `AIScripts` service, not CSHSE) | — | — |

**The `production` DNS (`cshse.courseworx.media`) is well-known to CSHSE members and must not change.** All migrations to a new env must preserve this domain by keeping it bound to the existing PROD `CSHSE` service.

## Key identifiers

(Captured 2026-05-16. Project + service IDs are stable; trigger IDs would change if a trigger is recreated.)

| Resource | ID |
|---|---|
| Project `bubbly-solace` | `87cb760d-784b-42cc-920f-712483a81664` |
| Service `CSHSE` (one service, two env instances) | `04e40a6b-9a9d-41ce-b1e3-355cd3171d21` |
| Service `MongoDB` | `6c3f905f-4a1a-4697-8294-2692a32ef357` |
| Env `production` | `e56e386b-b743-454f-ac8c-39c74738fe41` |
| Env `develop` | `7b03b69a-53d3-4425-8b3b-0e517d6611de` |
| Env `evaluation` | `4707a160-a780-4a41-bd8a-57dd06ee975c` |
| Deploy trigger — prod CSHSE (`main`) | `de23c3a8-3f43-47e2-b050-bad755b23f0b` |
| Deploy trigger — develop CSHSE (`developer`) | `01b0bf86-533e-47df-ae15-5a2df50b7ee4` |

## Service inventory by environment

The `bubbly-solace` project hosts 7 services total. All exist as service-instances in every environment, but most are **sleeping in `develop`** to avoid duplicate cost.

| Service | Used by CSHSE? | State in `develop` |
|---|---|---|
| CSHSE | ✓ core | active |
| MongoDB | ✓ data store | active |
| satisfied-clarity | ✗ unrelated app | **sleeping** |
| upwork-proposal | ✗ unrelated app | **sleeping** |
| WritersWorkbench | ✗ unrelated app | **sleeping** |
| PROD Redis | ✗ CSHSE uses no Redis (no `REDIS_URL` configured) | **sleeping** |

`evaluation` is unrelated to CSHSE — it hosts the `AIScripts` service on `main` for the broader repo.

## How a deploy happens

1. **Push** to `beserericl-hue/AIScripts`. The configFile `CSHSE/railway.json` + rootDirectory `/CSHSE` direct Railway to the right Dockerfile.
2. **Railway's GitHub webhook** matches the push branch to the env's deployment trigger:
   - `main` → `production` env CSHSE
   - `developer` → `develop` env CSHSE
3. **Docker build** runs against `CSHSE/Dockerfile` (per `CSHSE/railway.json`).
4. **Deploy** replaces the running container. `production` keeps the `cshse.courseworx.media` domain attached; `develop` uses its auto-generated `*.up.railway.app` domain.

## MongoDB isolation

Each environment has its own physical MongoDB volume. The `MongoDB` service exists in both envs but the **data is segregated** — Railway provisions a fresh volume per env-instance on duplicate.

Reference variables resolve per-environment:

```bash
# In each env, CSHSE's MONGO_URL is the literal string:
${{MongoDB.MONGO_URL}}
# Which auto-resolves at runtime to:
#   production: mongodb://mongo:...@mongo.production.internal:27017
#   develop:    mongodb://mongo:...@mongo.develop.internal:27017
```

So **a `db.dropDatabase()` in develop has zero blast radius on production**, by design.

## S3 / Tigris: shared bucket

**Gotcha:** Railway's "duplicate environment" feature, when a Tigris bucket service is in the source env, auto-provisions a *new* bucket in the duplicated env (with a fresh `tid_…` access key and a new `cshse-filestorage-…` suffix). On 2026-05-16 the duplicate of `production` → `develop` created `cshse-filestorage-nvffngd`, separate from prod's `cshse-filestorage-qlyj5pn`.

**Per requirement, both envs share `cshse-filestorage-qlyj5pn`.** This was wired by explicitly overriding the develop env's `AWS_*` variables with the prod values:

```bash
railway environment develop
railway variables --service CSHSE \
  --set "AWS_ACCESS_KEY_ID=$PROD_AWS_KEY" \
  --set "AWS_SECRET_ACCESS_KEY=$PROD_AWS_SECRET" \
  --set "AWS_S3_BUCKET_NAME=cshse-filestorage-qlyj5pn" \
  --set "AWS_ENDPOINT_URL=https://t3.storageapi.dev" \
  --set "AWS_DEFAULT_REGION=iad"
```

### About the "orphan" bucket

Railway's bucket model is one **Bucket entity per project** (`cshse-filestorage`, id `1fa7486c-…`), which provides env-scoped credentials. After the override, the physical Tigris bucket `cshse-filestorage-nvffngd` provisioned for the develop env has no service referencing it but **still exists on the Tigris side**, tracked by the project-level Bucket entity.

- There is **no separate tile** for `-nvffngd` in the Railway dashboard — only the single `cshse-filestorage` tile.
- Railway's GraphQL API has **no `bucketDelete` mutation** (only `bucketCreate`, `bucketUpdate` (renames only), `bucketCredentialsReset`).
- Deleting the project-level bucket tile would nuke prod's `-qlyj5pn` bucket too. **Do not do that.**
- Empty Tigris buckets cost effectively zero (charges are per-GB stored and per-operation). Leaving the orphan in place is the correct call.

### Implication for testing

Dev and prod share file storage. **Treat the bucket as production data even from develop.** Specifically:
- Don't delete files via the develop UI thinking they're isolated — they're not.
- Reuploading the same `s3Key` from develop overwrites prod's file.
- Test S3 deletion / replacement flows in a separate `dev-` keyspace (e.g., `dev/submissions/...`) until we ever decide to split buckets.

If isolated dev storage becomes necessary later: provision a separate Tigris bucket service for develop, generate fresh `AWS_*` vars, and override at the develop env level only.

## Process — common ops

### Add a new environment (e.g., `staging`)

```bash
# 1. Create the env duplicating the closest existing env
railway link --project bubbly-solace --environment production
railway environment new staging --duplicate production

# 2. Sleep services that aren't part of CSHSE
TOKEN=$(python3 -c "import json; print(json.load(open('~/.railway/config.json'.replace('~','/Users/ericbeser')))['user']['accessToken'])")
ENV_NEW=<new-env-id>
for SVC in <satisfied-clarity-id> <upwork-proposal-id> <writersworkbench-id> <prod-redis-id>; do
  curl -X POST https://backboard.railway.com/graphql/v2 \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"query\":\"mutation { serviceInstanceUpdate(environmentId: \\\"$ENV_NEW\\\", serviceId: \\\"$SVC\\\", input: { sleepApplication: true }) }\"}"
done

# 3. Override AWS_* on the new env to point at the shared bucket (see above)

# 4. Point the deploy trigger at the right branch via deploymentTriggerUpdate (see "Switch branch" below)
```

### Switch the branch an environment deploys

The CLI doesn't expose this — use the GraphQL API.

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/Users/ericbeser/.railway/config.json'))['user']['accessToken'])")
TRIGGER_ID="de23c3a8-…"  # find via: query environment.deploymentTriggers
NEW_BRANCH="main"

curl -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { deploymentTriggerUpdate(id: \\\"$TRIGGER_ID\\\", input: { branch: \\\"$NEW_BRANCH\\\" }) { id branch } }\"}"

# Then trigger an immediate deploy of the new branch:
curl -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { serviceInstanceDeployV2(environmentId: \\\"<env-id>\\\", serviceId: \\\"<svc-id>\\\", commitSha: null) }\"}"
```

### Promote develop → production

Standard flow once code is reviewed on `developer`:

```bash
git checkout main
git pull
git merge --ff-only developer   # developer is a fast-forward ahead of main
git push origin main            # Railway auto-deploys main to production
```

If `developer` has diverged from `main` (rare), use a PR + merge commit; never force-push to `main`.

### Find current branch / state via CLI

```bash
railway link --project bubbly-solace --environment <env>
railway status --json | jq '.environments.edges[].node.serviceInstances.edges[].node | {service: .serviceName, branch: .latestDeployment.meta.branch, commit: .latestDeployment.meta.commitHash}'
```

### Roll back a bad deploy

```bash
railway environment production
railway service CSHSE
railway logs                                    # find the last-known-good deploy id
railway redeploy --deployment <last-good-id>    # or use serviceInstanceDeployV2 with a known commitSha
```

## Qdrant — single shared instance (prod env only)

Both production and develop CSHSE services point at **one Qdrant service running in the production env** (`turntable.proxy.rlwy.net:17813` externally, `qdrant.railway.internal:6333` from inside the project). The develop env's Qdrant instance is intentionally **kept asleep**.

**Why:** Qdrant holds spec embeddings (the same in every env — the CSHSE Handbook doesn't differ between prod and dev) and per-import section embeddings. Multi-env isolation is via Qdrant **collection-name suffixes**:

- `cshse_specs` — shared read-only (every env reads the same spec definitions)
- `cshse_sections_prod` / `cshse_sections_dev` — env-scoped per-import writes
- `cshse_narratives_xinst_prod` / `…_dev` — env-scoped cross-institution data

Running a second Qdrant in develop adds confusion (two sources of truth, double the storage cost, the dev instance lags or drifts from prod) for no operational benefit on a RAG retrieval workload. Confirmed by user 2026-05-17 after a brief experiment of waking dev's instance.

If develop ever needs full isolation (e.g. you want to run destructive vector experiments without prod risk), wake it via:

```bash
TOKEN=$(jq -r .user.accessToken ~/.railway/config.json)
curl -X POST https://backboard.railway.com/graphql/v2 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"mutation { serviceInstanceUpdate(environmentId: \"7b03b69a-53d3-4425-8b3b-0e517d6611de\", serviceId: \"88a41a9a-f0c4-46f2-be0b-b4ea7d62532d\", input: { sleepApplication: false }) }"}'
```

…then re-point the dev `cshse-ai` service's `QDRANT_URL` from `qdrant.railway.internal` to the dev-env Qdrant. Default: sleep, share prod's.

## Open items

- Consider whether `develop` should auto-deploy on every push to `developer` (it does today) or require manual promotion. Auto-deploy is cheaper to operate; manual is safer if `developer` is unstable.
- The `developer` branch is currently a strict superset of `main` (synced 2026-05-16, both at `0eba024`). If divergence becomes regular, codify a "merge `main` into `developer` weekly" rule so develop never lags behind prod fixes.
- The orphan `cshse-filestorage-nvffngd` bucket can't be deleted from the API and shares the same dashboard tile as prod's `-qlyj5pn`. Cost is zero — left in place by decision.

## Related

- [[system-architecture]] — overall tier diagram.
- [[storage-layer]] — what's actually in MongoDB / GridFS / S3.
- [[sprint-plan-2026-05-11]] — the active sprint plan that motivated splitting prod/dev (Sprint 1 security work shouldn't run against production data).
