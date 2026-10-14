FROM python:3.12.13@sha256:4adb35718b43e361d1bb3a086746f0d9ff7f05f965a3d01aded657933a0c31a5

ARG APP_UID=1000
ARG APP_GID=1000

COPY --from=ghcr.io/astral-sh/uv:0.5.9@sha256:ba36ea627a75e2a879b7f36efe01db5a24038f8d577bd7214a6c99d5d4f4b20c /uv /uvx /usr/local/bin/

WORKDIR /app

# System deps required by OpenCV (used by ultralytics)
RUN apt-get update -q && apt-get install -y -q libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Copy dependency files to cache them in docker layer
COPY backend/pyproject.toml backend/uv.lock ./

# Stub out the editable packages so uv sync can resolve them
RUN mkdir -p src/app src/pydantic_models && \
    touch src/app/__init__.py src/pydantic_models/__init__.py && \
    uv sync --frozen --group test

# Install ultralytics with CPU-only torch into the project venv (GPU training happens on host)
RUN uv pip install --python .venv/bin/python \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    uv pip install --python .venv/bin/python ultralytics

COPY scripts/docker/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic

# Runtime user stays aligned with the host's default Linux UID/GID so the
# writable bind mounts remain usable without falling back to UID 0. `/app/data`
# is pre-created so a first-run named volume inherits app-owned permissions.
RUN groupadd --gid "${APP_GID}" app && \
    useradd --uid "${APP_UID}" --gid "${APP_GID}" --create-home --home-dir /home/app --shell /bin/sh app && \
    mkdir -p /app/uploads /app/data /home/app && \
    chmod 755 /app/docker-entrypoint.sh && \
    chown -R app:app /app /home/app

ENV PYTHONPATH=/app/src

EXPOSE 8000

USER app

ENTRYPOINT ["/app/docker-entrypoint.sh"]
