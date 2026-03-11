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

    def test_alembic_ini_points_to_correct_sqlalchemy_url(self):
        ini = (PROJECT_ROOT / 'alembic.ini').read_text()
        assert 'sqlite:' in ini, 'alembic.ini must have a SQLite connection string'

    def test_env_py_imports_from_app_models(self):
        """env.py must import Base from the new app.database.models module."""
        env_py = (PROJECT_ROOT / 'alembic' / 'env.py').read_text()
        assert 'from app.database.models import' in env_py

    def test_env_py_has_render_as_batch_offline(self):
        """env.py run_migrations_offline must have render_as_batch=True for SQLite ALTER support."""
        env_py = (PROJECT_ROOT / 'alembic' / 'env.py').read_text()
        # Find the offline configure block and verify render_as_batch=True is present
        offline_start = env_py.index('def run_migrations_offline')
        online_start = env_py.index('def run_migrations_online')
        offline_block = env_py[offline_start:online_start]
        assert 'render_as_batch=True' in offline_block, (
            'run_migrations_offline() context.configure() must include render_as_batch=True'
        )

    def test_env_py_has_render_as_batch_online(self):
        """env.py run_migrations_online must have render_as_batch=True for SQLite ALTER support."""
        env_py = (PROJECT_ROOT / 'alembic' / 'env.py').read_text()
        online_start = env_py.index('def run_migrations_online')
        online_block = env_py[online_start:]
        assert 'render_as_batch=True' in online_block, (
            'run_migrations_online() context.configure() must include render_as_batch=True'
        )


class TestAlembicMigrations:
    """T-006: Migration creates and drops all 5 new tables."""

    EXPECTED_TABLES = {'players', 'game_sessions', 'game_players', 'hands', 'player_hands'}

    def _run_alembic(self, command_name, revision, db_url):
        from alembic.config import Config
        from alembic import command as alembic_command

        cfg = Config(str(PROJECT_ROOT / 'alembic.ini'))
        cfg.set_main_option('sqlalchemy.url', db_url)
        getattr(alembic_command, command_name)(cfg, revision)

    def test_migration_file_exists(self):
        """At least one migration file must exist in alembic/versions/."""
        versions_dir = PROJECT_ROOT / 'alembic' / 'versions'
        py_files = [f for f in versions_dir.iterdir() if f.suffix == '.py']
        assert len(py_files) >= 1, 'No migration files found in alembic/versions/'

    def test_upgrade_head_creates_all_tables(self, tmp_path):
        """alembic upgrade head must create all 5 new tables."""
        from sqlalchemy import create_engine, inspect

        db_path = tmp_path / 'test_migration.db'
        db_url = f'sqlite:///{db_path}'

        self._run_alembic('upgrade', 'head', db_url)

        engine = create_engine(db_url)
        tables = set(inspect(engine).get_table_names())
        engine.dispose()

        assert self.EXPECTED_TABLES.issubset(tables), (
            f'Missing tables after upgrade: {self.EXPECTED_TABLES - tables}'
        )

    def test_downgrade_base_drops_all_tables(self, tmp_path):
        """alembic downgrade base must drop all 5 new tables."""
        from sqlalchemy import create_engine, inspect

        db_path = tmp_path / 'test_migration.db'
        db_url = f'sqlite:///{db_path}'

        self._run_alembic('upgrade', 'head', db_url)
        self._run_alembic('downgrade', 'base', db_url)

        engine = create_engine(db_url)
        tables = set(inspect(engine).get_table_names())
        engine.dispose()

        remaining = self.EXPECTED_TABLES & tables
        assert not remaining, (
            f'Tables still exist after downgrade: {remaining}'
        )
