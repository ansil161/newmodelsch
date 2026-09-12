# syntax=docker/dockerfile:1

# ai_service — API and worker, from one image.
#
# ONE IMAGE, TWO PROCESSES. The API and the worker share every module they
# import; building them separately would mean two images to keep in step and
# a class of bug where a deploy updates one and not the other. They differ
# only in the command, which docker-compose and any orchestrator can set.
#
# TWO STAGES. Wheels are built in the first stage and only the installed
# packages are copied into the second, so no compiler, no build headers and
# no pip cache ship to production. The runtime layer is what gets scanned and
# what gets attacked; keeping it to the interpreter and the dependencies is
# the cheapest security work available.

# ---------------------------------------------------------------------------
# Stage 1 — build the dependency tree
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build

# Copied first, and alone. This layer is invalidated only when the
# requirements change, so editing application code rebuilds in seconds
# instead of reinstalling every dependency.
COPY requirements.txt requirements-local-models.txt ./

# INCLUDE_LOCAL_MODELS=true adds torch and sentence-transformers, for running
# BAAI/bge-base-en-v1.5 in-process rather than calling Hugging Face's hosted
# inference. It is off by default because it takes the image from roughly
# 400MB to well over 3GB, and the hosted provider produces identical vectors.
# Turn it on for a deployment that must not send document text off the box,
# or that cannot tolerate the hosted API's cold starts.
ARG INCLUDE_LOCAL_MODELS=false

RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt \
    && if [ "$INCLUDE_LOCAL_MODELS" = "true" ]; then \
    /opt/venv/bin/pip install -r requirements-local-models.txt; \
    fi

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    # .pyc files written at runtime are never reused — the container is
    # replaced, not restarted — and they make the filesystem writable in
    # places it does not need to be.
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    # numpy and torch otherwise allocate per-thread buffers for every core on
    # the host, which oversubscribes badly when several containers share a
    # box and fails outright on a memory-limited one. The container's CPU
    # limit is not visible to them; this is.
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    # Model weights, when the local provider is in use. Named explicitly so
    # it can be mounted as a volume — otherwise every container restart
    # re-downloads several hundred megabytes.
    HF_HOME=/home/app/.cache/huggingface

# Never root. A remote code execution in a dependency is a much smaller
# problem when the process cannot write to its own application directory.
RUN groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --create-home app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=app:app app ./app
COPY --chown=app:app pyproject.toml ./

USER app

EXPOSE 8001

# Liveness only. A healthcheck that verified Qdrant would restart a perfectly
# healthy container because a *dependency* blinked, turning one outage into a
# restart loop. Readiness — which does check dependencies — is what an
# orchestrator should poll to decide whether to route traffic, and it is at
# /health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health/live', timeout=4).status == 200 else 1)"

# One worker process per container, scaled by running more containers.
# uvicorn's own --workers forks the process *after* the module is imported,
# which with the local embedding provider means several hundred megabytes of
# model weights loaded once per fork inside a single memory limit.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
