"""Tests for T-001: Alembic database migration setup."""

import importlib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class TestAlembicDependency:
    """AC-1: alembic is in pyproject.toml dependencies."""

    def test_alembic_is_importable(self):
        """Alembic package must be installed and importable."""
        alembic = importlib.import_module('alembic')
        assert hasattr(alembic, '__version__')

    def test_alembic_in_pyproject(self):
        """alembic must appear as a dependency in pyproject.toml."""
        pyproject = (PROJECT_ROOT / 'pyproject.toml').read_text()
        assert 'alembic' in pyproject.lower()


class TestAlembicDirectoryStructure:
    """AC-2: alembic/ directory exists with env.py configured."""

    def test_alembic_directory_exists(self):
        alembic_dir = PROJECT_ROOT / 'alembic'
        assert alembic_dir.is_dir(), 'alembic/ directory must exist'

    def test_env_py_exists(self):
        env_py = PROJECT_ROOT / 'alembic' / 'env.py'
        assert env_py.is_file(), 'alembic/env.py must exist'

    def test_alembic_ini_exists(self):
        ini = PROJECT_ROOT / 'alembic.ini'
        assert ini.is_file(), 'alembic.ini must exist at project root'

    def test_versions_directory_exists(self):
        versions = PROJECT_ROOT / 'alembic' / 'versions'
        assert versions.is_dir(), 'alembic/versions/ directory must exist'


class TestAlembicConfiguration:
    """AC-2 continued: env.py imports the app's Base and engine."""

    def test_env_py_imports_base(self):
        env_py = (PROJECT_ROOT / 'alembic' / 'env.py').read_text()
        assert 'Base' in env_py, 'env.py must reference Base'

    def test_env_py_sets_target_metadata(self):
        env_py = (PROJECT_ROOT / 'alembic' / 'env.py').read_text()
        assert 'target_metadata = Base.metadata' in env_py

    def test_env_py_imports_from_app(self):
        env_py = (PROJECT_ROOT / 'alembic' / 'env.py').read_text()
        assert 'from app.database.database_models import' in env_py

    def test_alembic_ini_points_to_correct_sqlalchemy_url(self):
        ini = (PROJECT_ROOT / 'alembic.ini').read_text()
        assert 'sqlite:' in ini, 'alembic.ini must have a SQLite connection string'
