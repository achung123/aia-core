#!/usr/bin/env bash
# Install uv and sync project dependencies
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync --group test --group dev
