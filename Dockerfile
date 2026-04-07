FROM python:3.12

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

ENV PYTHONPATH=/src

# Copy dependency files to cache them in docker layer
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --group test

WORKDIR /src
EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
