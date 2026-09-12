# ai_service

Retrieval-augmented generation over the JAAZ knowledge base.

A FastAPI service that owns everything AI in this system: the vector store,
the embedding model, hybrid retrieval, reranking, prompt construction,
generation, provider fallback and citations. It holds every AI credential in
the product and is the only process that does.

---

## 1. Where this sits

```
   Browser                Django                  ai_service
   ───────                ──────                  ──────────
   session cookie   →   authenticates        →   shared bearer token
   no credentials       owns conversations       owns Qdrant + LLM keys
   no knowledge of      owns documents           stores nothing
   Qdrant/Gemini/HF     owns users               stateless, scales flat
```

Three rules follow from that picture, and most of the design follows from
them:

**The browser never talks to this service.** It talks to Django, which
authenticates the session and forwards the question with the user's identity
attached. No script on a page is ever within reach of a Qdrant key, a Gemini
key or a Hugging Face token.

**This service stores nothing.** Conversations, messages and documents live
in Django's database, beside the accounts they belong to — one set of access
rules rather than two that can disagree, one backup, one place to answer a
deletion request. Relevant turns arrive in the request body. That is what
lets this service be redeployed without a migration and scaled horizontally
with no shared state.

**Identity is asserted by Django, not by the caller.** The shared token
proves the request came from the backend that holds the session. The
`X-Jaaz-Tenant-Id` and `X-Jaaz-User-Id` headers are believed *because* of
that token, and they are the only thing a Qdrant filter is ever built from.
Nothing downstream reads a tenant out of a request body.

---

## 2. Request flow

```
question
  │
  ├─ validate, resolve against conversation history
  │    └─ rewrite only when the question cannot stand alone
  │
  ├─ hybrid retrieval ──┬─ dense   embed → Qdrant cosine, top 30
  │  (both concurrently)└─ sparse  tokenise → Qdrant IDF, top 30
  │                        │
  │                     RRF (k=60, weighted)
  │                        │
  │                     cross-encoder rerank, top 20 → top 6
  │
  ├─ build context: sanitise, deduplicate, fit the character budget
  ├─ grounded prompt: documents as data, never as instructions
  ├─ generate: primary provider, fallback on the right failures only
  └─ citations resolved against what was actually retrieved
```

The two searches run under one `asyncio.gather`, so hybrid retrieval costs
roughly what a single search costs. If one half fails the other still
answers — only both failing is an error.

### Ingestion

Django owns the file, the document's state and the job queue; this service
does the work that needs a parser, a model or the network. A document is
extracted and indexed in two calls, so the console can show which step a
document is on and which one failed:

```
POST /ingestion/extract        bytes in  → blocks → clean → chunks out
POST /ingestion/extract-url    address   → safe fetch → the same pipeline
POST /knowledge-base/documents chunks in → embeddings → Qdrant
```

- **Detect** the format from the bytes, not the name: a `.pdf` that is
  really a ZIP is refused as a mismatch.
- **Parse** into typed blocks — heading, paragraph, list item, table, code —
  keeping page numbers and the heading path. PDF (outline and font-size
  headings), DOCX, Markdown, text, CSV and JSON, and HTML for web pages.
  Encrypted and image-only PDFs are refused with a reason, not indexed empty.
- **Clean**: Unicode NFC plus a ligature map (not NFKC, which rewrites
  meaning), repeated page headers and footers removed, hard-wrapped lines
  reflowed, PDF hyphenation undone.
- **Chunk** by structure: sections first, ~300 tokens a chunk, never above
  420, 45 tokens of overlap, each chunk prefixed with its section path
  (`Admissions › Fees`) so a passage carries its own context.
- **Limits** on every axis a hostile file can grow in — bytes, pages,
  extracted characters, decompressed size, compression ratio, table rows,
  chunks — each refused with a code the console turns into a sentence.

**Web pages are fetched as if the address were hostile.** Only http(s) on
ports 80 and 443; the name is resolved and *every* address must be public
(no loopback, private, link-local, cloud-metadata or reserved ranges); the
connection goes to the vetted IP, so a second DNS answer cannot redirect it;
each redirect is validated again; proxies from the environment are ignored;
the body is capped after decompression; only HTML and text content types are
accepted.

**Re-indexing never leaves a gap or an orphan.** Every index run has a
generation (Django's job id). Points are written under the new generation
first, then every other generation of that document is deleted; a write that
fails part-way is rolled back. Until the new generation is complete, the old
one keeps answering — and only the active version of a document is ever in
the index.

---

## 3. Layout

```
app/
├── main.py                    FastAPI app; everything expensive in the lifespan
├── api/
│   ├── dependencies.py        auth, identity, rate limiting, resource injection
│   ├── middleware.py          request ids, structured access logs, error shape
│   └── v1/
│       ├── chat.py            POST /chat, POST /chat/stream
│       ├── ingestion.py       POST /ingestion/extract, /ingestion/extract-url
│       ├── knowledge_base.py  index + delete documents and knowledge bases, stats
│       ├── rag.py             POST /rag/test — the traced pipeline (admins only)
│       ├── retrieval.py       POST /retrieval/search (the console's search box)
│       └── health.py          live, ready, summary
├── core/
│   ├── config.py              every tunable value, typed, validated at import
│   ├── lifecycle.py           the expensive objects, built once
│   ├── security.py            shared-token verification, CallerIdentity
│   ├── logging.py             structured logs, request context, Stopwatch
│   └── exceptions.py          the error taxonomy and its wire envelope
├── modules/
│   ├── chat/                  request → answer or SSE stream
│   ├── ingestion/             format detection, parsers, cleaning, chunking,
│   │                          the SSRF-safe URL fetcher
│   ├── rag/                   pipeline, context builder, prompts, citations,
│   │                          grounding (support level), diagnostics
│   ├── retrieval/             hybrid search, RRF, reranking, query rewriting
│   ├── embeddings/            BGE behind an interface; dense + sparse
│   ├── llm/                   Gemini, Groq/xAI, fallback, factory, shared
│   │                          HTTP plumbing
│   ├── vector_store/          Qdrant behind an interface; metadata filters
│   └── indexing/              chunks in, vectors in Qdrant
├── workers/                   the reindex worker, its queue, its jobs
└── shared/                    types.py  domain nouns used across modules
                               schemas.py wire types used by more than one
                               endpoint

tests/
├── unit/          fusion, citations, context, filters, fallback, rewriting,
│                  the HTTP providers (respx, at the transport boundary)
├── integration/   the API through its real dependency graph, fakes at the edge
└── evaluation/    retrieval and answer quality against a labelled dataset
```

Each module owns its own wire contract: `modules/chat/schemas.py`,
`modules/indexing/schemas.py` and `modules/retrieval/schemas.py` hold the
request and response models for the endpoints those modules serve, so a route
file validates, delegates and returns and holds no schema of its own. The one
exception is `shared/schemas.py`, for the types that appear in more than one
response — `SourceOut` is returned by both chat and retrieval, and having
`retrieval` import it from `chat` is exactly the coupling `shared/` exists to
prevent.

`modules/` are modules, not services. Retrieval calling embeddings is a
function call, not an HTTP request — splitting them into separate deployables
would buy nothing and cost a network hop, a failure mode and a deployment
unit each.

---

## 4. Providers

| Concern | Implementation | Swapped by |
|---|---|---|
| Embeddings | `BAAI/bge-base-en-v1.5`, 768-d, L2-normalised | `EMBEDDING__PROVIDER` |
| Vector store | Qdrant Cloud, cosine | a new `VectorStore` implementation |
| Reranker | `BAAI/bge-reranker-base` cross-encoder | `RERANKER__PROVIDER` |
| Primary LLM | Gemini | `LLM__PRIMARY` |
| Fallback LLM | Groq (xAI also supported) | `LLM__FALLBACK` |

Embeddings run either as `sentence_transformers` (in-process, needs
`requirements-local-models.txt`) or `huggingface_api` (hosted). Both use the
same model and produce interchangeable vectors, so switching does **not**
require reindexing. The local provider costs ~1.5GB of disk and gives no
network hop, no cold starts, no rate limit, and document text that never
leaves the machine.

Fallback is deliberate, not blanket. A timeout, a 5xx, a rate limit or a
connection failure moves to the next provider. A malformed request does not —
the second provider would reject it identically, for twice the latency.

---

## 5. Running it

### Locally, without Docker

```bash
cd ai_service
python -m venv venv
venv/Scripts/pip install -r requirements.txt        # Windows
# venv/bin/pip install -r requirements.txt          # POSIX

cp .env.example .env        # then fill in the keys
venv/Scripts/python -m uvicorn app.main:app --port 8001 --reload
```

The worker is a separate process and only needed for a reindex:

```bash
venv/Scripts/python -m app.workers.worker           # serve the queue
venv/Scripts/python -m app.workers.worker reindex   # one pass, then exit
```

### With Docker

```bash
docker compose up --build                            # API + worker + Qdrant
docker compose --profile local-models up --build api-local-models
```

Compose runs a local Qdrant, so `QDRANT__URL` is overridden to the service
name; everything else comes from your `.env`. It deliberately does **not**
run Django, Postgres or the frontend — those have their own lifecycles, and
one compose file spanning all of them has to be restarted in full to change a
setting in any of them.

### The whole product

Four processes, in this order:

```bash
# 1. ai_service
cd ai_service && venv/Scripts/python -m uvicorn app.main:app --port 8001

# 2. Django
cd backend && venv/Scripts/python manage.py migrate
              venv/Scripts/python manage.py runserver 8000

# 3. the knowledge-base worker (only with KB_TASK_DISPATCH=worker, the default
#    outside development settings)
cd backend && venv/Scripts/python manage.py process_documents

# 4. the frontend
cd client && npm run dev        # proxies /api to 127.0.0.1:8000
```

`SECURITY__SERVICE_TOKEN` here and `AI_SERVICE_TOKEN` in `backend/.env` are
the same secret. Give your account a workspace role
(`manage.py grant_workspace_access you@school.org --role admin`), sign in at
`/login` and open **Knowledge base** in the console.

Without a Qdrant server to hand, `QDRANT__LOCAL_PATH=./var/qdrant` runs an
embedded one on disk — development only; production refuses it.

---

## 6. API

Every route below `/api/v1` requires the shared bearer token and the identity
headers. The health probes do not.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/chat` | A complete answer |
| `POST` | `/api/v1/chat/stream` | The same answer as Server-Sent Events |
| `POST` | `/api/v1/ingestion/extract` | Parse and chunk an uploaded file (multipart) |
| `POST` | `/api/v1/ingestion/extract-url` | Fetch a public page safely, then parse and chunk it |
| `POST` | `/api/v1/knowledge-base/documents` | Embed and index a document's chunks as one generation |
| `DELETE` | `/api/v1/knowledge-base/documents/{id}` | Remove a document from the index |
| `DELETE` | `/api/v1/knowledge-base/bases/{id}` | Remove a whole knowledge base from the index |
| `GET` | `/api/v1/knowledge-base/stats` | Points in the index, for a knowledge base or a document |
| `POST` | `/api/v1/retrieval/search` | Retrieval without generation |
| `POST` | `/api/v1/rag/test` | The production pipeline with its trace; needs `X-Jaaz-Is-Admin` |
| `GET` | `/health/live` | Is the process up |
| `GET` | `/health/ready` | Should traffic be routed here |
| `GET` | `/health` | What is configured and reachable |

### Streaming protocol

```
event: message_start     { conversationId, messageId }
event: sources           { sources: [...] }        ← before the first token
event: token             { delta: "…" }            ← new text only, never cumulative
event: message_complete  { answer, sources, metadata }
event: error             { error: { code, message } }
: keepalive                                        ← comment frame; clients ignore it
```

`sources` arrives as soon as retrieval finishes, which is typically a second
or two before the first token — that is what lets the UI show source cards
while the model is still starting.

`message_complete` carries the authoritative answer. It is the streamed text
with any citation marker the model invented removed, so a client should
replace what it accumulated rather than append to it.

---

## 7. Configuration

Every value is in `.env.example` with a comment explaining what it does and
what happens if it is wrong. Nested settings use a double underscore:
`QDRANT__API_KEY` sets `Settings.qdrant.api_key`.

The ones without a safe default:

```
SECURITY__SERVICE_TOKEN     shared secret; required in production
QDRANT__URL, QDRANT__API_KEY
EMBEDDING__API_KEY          hosted provider only
LLM__GEMINI__API_KEY
LLM__GROQ__API_KEY
```

Cross-field validation runs at import, so a mistake fails at startup with a
message naming the variable rather than at 3am inside a retrieval call:

- `QDRANT__VECTOR_SIZE` must equal `EMBEDDING__DIMENSIONS`. A collection
  whose width disagrees with the model accepts nothing and explains nothing.
- `LLM__FALLBACK` must differ from `LLM__PRIMARY`. Falling back to the
  provider that just failed is not a fallback.
- `RETRIEVAL__FINAL_CONTEXT_CHUNKS` cannot exceed `RETRIEVAL__RERANK_TOP_K`.
- In production, a service token and a primary-provider key are mandatory.
  The process refuses to start without them.
- In production, `URL_FETCH__ALLOW_PRIVATE_NETWORKS` and `QDRANT__LOCAL_PATH`
  are refused: one turns URL ingestion into a way to read internal services,
  the other is an embedded store with no replication.
- Chunk sizes must be ordered (`INGESTION__CHUNK_MIN_TOKENS` <
  `…_TARGET_TOKENS` ≤ `…_MAX_TOKENS`, overlap below the target) and the
  largest chunk must fit the embedding model's sequence length.

`ASSISTANT__NAME` is how the assistant refers to itself in answers — set it to
the school's name for the assistant.

**Never commit a real key.** `.env` is git-ignored and docker-ignored;
`.env.example` holds placeholders only. Secrets are injected at run time, not
baked into an image — anyone who can run `docker history` can read a build
argument.

---

## 8. Accuracy dials

All in `RETRIEVAL__*`, all tuned together rather than individually:

| Setting | Default | Effect |
|---|---|---|
| `DENSE_TOP_K` / `SPARSE_TOP_K` | 30 / 30 | Candidates from each retriever |
| `FUSION_K` | 60 | RRF smoothing; lower sharpens top ranks |
| `DENSE_WEIGHT` / `SPARSE_WEIGHT` | 1.0 / 1.0 | Raise sparse for part numbers and codes, dense for prose |
| `RERANK_TOP_K` | 20 | What the cross-encoder scores — the main latency/quality dial |
| `FINAL_CONTEXT_CHUNKS` | 6 | What reaches the prompt |
| `SIMILARITY_THRESHOLD` | 0.30 | Dense cosine floor, applied before fusion |
| `MAX_CONTEXT_CHARACTERS` | 12000 | Guards the window and the bill |

Raising `DENSE_TOP_K` without raising `RERANK_TOP_K` only gives the reranker
more to discard.

---

## 9. Tests

```bash
venv/Scripts/python -m pytest tests            # everything
venv/Scripts/python -m pytest tests/unit       # pure logic, fast
venv/Scripts/python -m pytest -m evaluation -s # quality report
```

No test calls a paid API. Providers are faked at the HTTP boundary with
`respx` (`tests/unit/test_llm_providers.py`), so the request this service
actually builds is asserted — its JSON body, its headers and its URL. A
mocked client would only assert that the mock was called.

`tests/evaluation/` measures retrieval quality (hit rate, recall, precision,
MRR, NDCG) and answer quality (groundedness, citation correctness) against a
labelled dataset, and prints a per-question report. It compares dense, sparse
and hybrid retrieval side by side, which is the evidence for the hybrid
design rather than an assertion of it. It is a report, not a pass/fail gate.

---

## 10. Two things deliberately not used

### No LangChain

It earns its place for heterogeneous document loading and for swapping
between many providers behind one interface. Here, there are six document
formats, each parsed into the same typed blocks by a small parser that is
tested against real files and hostile ones, and two LLM providers, both
reached over plain REST with `httpx`.
What LangChain would add is an abstraction layer over four HTTP calls, plus a
dependency whose own interfaces have changed shape repeatedly, plus friction
at exactly the point that matters most: token streaming interleaved with
provider fallback. The direct implementation is smaller, faster to read, and
fully covered by tests.

### No LangGraph

The pipeline has two conditional branches (rewrite-or-not,
context-or-no-context), one parallel step (`asyncio.gather` over two
searches, one line), and a state object that is a dataclass. LangGraph earns
its complexity on workflows with cycles, human-in-the-loop interrupts,
checkpointed resumption, or a dozen interacting nodes. None of those apply.

If graph-level tooling is wanted later — visualisation, per-node
checkpointing, interrupts — `modules/rag/pipeline.py` is the only file that
changes. Every stage in it is already an injected collaborator with its own
tests.

---

## 11. Known limitations

Honest list, in rough order of how soon each will matter.

**Rate limiting is per-process.** `SlidingWindowRateLimiter` counts in
memory: correct for one instance, an approximation for two, and reset by a
restart. It exists because an unlimited chat endpoint is an unlimited bill.
A shared Redis counter is the upgrade; the class is the seam for it.

**The reindex queue is not durable.** `InMemoryJobQueue` loses jobs on
restart. Acceptable for the one job it runs — a reindex is idempotent,
restartable and operator-initiated — and unacceptable for anything where loss
matters. `JobQueue` is the interface to implement.

**Document ingestion is driven by Django, not by this service's worker.**
This service parses, chunks and indexes; Django decides when. Its
`process_documents` command already claims rows with
`SELECT … FOR UPDATE SKIP LOCKED`, survives restarts, reclaims work abandoned
by a dead worker and counts attempts. Putting a second queue behind it would
mean Django could no longer distinguish a document it marked READY from one
still sitting in this service's queue — a status-tracking problem in exchange
for latency no user experiences, since their request ended before Django's
worker picked the document up.

**Tenants are workspaces.** `tenant_id` is threaded through identity, filters
and every Qdrant query; Django sends the workspace id, and a knowledge-base
filter only ever narrows within it. An empty knowledge-base list matches
nothing rather than everything.

**Scanned PDFs are refused, not read.** There is no OCR: a PDF whose pages
carry no text layer fails with `NO_EXTRACTABLE_TEXT` and says so.

**No distributed tracing.** Logs are structured and carry a request id
through every stage, which is enough to reconstruct one request. Correlating
across Django and this service means matching ids by hand. OpenTelemetry is
the obvious addition and nothing here obstructs it.

**Answer quality depends on chunking.** The retrieval metrics in
`tests/evaluation/` measure retrieval over given chunks. If answers are poor
and retrieval scores are good, the chunk boundaries are the place to look —
`app/modules/ingestion/chunking.py` — and a change there needs every document
reprocessed.

**Sparse retrieval is term-frequency, not BM25 or SPLADE.** Vectors are built
here and scored by Qdrant's IDF modifier. That is genuinely good at the thing
sparse retrieval is for — part numbers, SKUs, exact phrases — and is not a
learned sparse model. A change here invalidates every stored sparse vector
and needs a reindex.
