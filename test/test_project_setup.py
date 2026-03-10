"""Tests that validate the project uses uv with PEP 621 metadata."""

import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_pyproject_has_pep621_project_table():
    with open(ROOT / 'pyproject.toml', 'rb') as f:
        data = tomllib.load(f)
    assert 'project' in data, 'pyproject.toml must have a [project] table'
    assert 'name' in data['project']
    assert 'requires-python' in data['project']


def test_pyproject_has_no_poetry_sections():
    with open(ROOT / 'pyproject.toml', 'rb') as f:
        data = tomllib.load(f)
    assert 'tool' not in data or 'poetry' not in data.get('tool', {}), (
        'pyproject.toml must not contain [tool.poetry] sections'
    )


def test_pyproject_has_dependency_groups():
    with open(ROOT / 'pyproject.toml', 'rb') as f:
        data = tomllib.load(f)
    assert 'dependency-groups' in data, 'pyproject.toml must have [dependency-groups]'
    assert 'test' in data['dependency-groups']
    assert 'dev' in data['dependency-groups']


def test_uv_lock_exists():
    assert (ROOT / 'uv.lock').exists(), 'uv.lock must exist'


def test_poetry_lock_does_not_exist():
    assert not (ROOT / 'poetry.lock').exists(), 'poetry.lock must not exist'
