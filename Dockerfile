FROM python:3.12

COPY ./src /src 

ENV POETRY_NO_INTERACTION=1 \
  POETRY_VIRTUALENVS_CREATE=false \
  POETRY_CACHE_DIR='/var/cache/pypoetry' \
  POETRY_HOME='/usr/local' \
  POETRY_VERSION=1.7.1
  # ^^^
  # Make sure to update it!

# System deps:
RUN curl -sSL https://install.python-poetry.org | python3 -

# Copy only requirements to cache them in docker layer
COPY pyproject.toml . 
RUN poetry install --no-root

WORKDIR /src
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]