FROM ghcr.io/astral-sh/uv:latest AS uv

FROM python:3.12

# Copy uv from the uv image
COPY --from=uv /uv /usr/local/bin/uv

ENV PYTHONPATH=/src

# Copy only requirements to cache them in docker layer
COPY pyproject.toml uv.lock* .
# Export dependencies from pyproject.toml and install them
# --no-emit-workspace: exclude local package (matching Poetry's --no-root behavior)
# --no-dev: exclude dev dependencies
# --no-editable: ensure non-editable installs
RUN uv export --no-emit-workspace --no-dev --no-editable -o requirements.txt && \
    uv pip install --system -r requirements.txt

WORKDIR /src
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
