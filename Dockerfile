FROM python:3.12

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Copy dependency files to cache them in docker layer
COPY pyproject.toml uv.lock ./

# Stub out the editable packages so uv sync can resolve them
RUN mkdir -p src/app src/pydantic_models && \
    touch src/app/__init__.py src/pydantic_models/__init__.py && \
    uv sync --frozen --group test

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic

ENV PYTHONPATH=/app/src

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
