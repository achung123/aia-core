FROM python:3.12

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# System deps required by OpenCV (used by ultralytics)
RUN apt-get update -q && apt-get install -y -q libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

# Copy dependency files to cache them in docker layer
COPY pyproject.toml uv.lock ./

# Stub out the editable packages so uv sync can resolve them
RUN mkdir -p src/app src/pydantic_models && \
    touch src/app/__init__.py src/pydantic_models/__init__.py && \
    uv sync --frozen --group test

# Install ultralytics with CPU-only torch into the project venv (GPU training happens on host)
RUN uv pip install --python .venv/bin/python \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    uv pip install --python .venv/bin/python ultralytics

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

# Ensure uploads directory exists for bind-mount target
RUN mkdir -p /app/uploads

ENV PYTHONPATH=/app/src

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
