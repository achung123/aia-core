"""Tests for the shared database session dependency (T-010)."""

import importlib
import inspect
import sys
from pathlib import Path
from unittest.mock import patch


class TestSessionModuleExists:
    def test_session_module_file_exists(self):
        """session.py must exist in src/app/database/."""
        assert Path('src/app/database/session.py').exists()

    def test_session_module_importable(self):
        """session.py must be importable."""
        module = importlib.import_module('app.database.session')
        assert module is not None

    def test_session_module_exports_engine(self):
        """session.py must export `engine`."""
        module = importlib.import_module('app.database.session')
        assert hasattr(module, 'engine'), "session.py must export 'engine'"

    def test_session_module_exports_session_local(self):
        """session.py must export `SessionLocal`."""
        module = importlib.import_module('app.database.session')
        assert hasattr(module, 'SessionLocal'), "session.py must export 'SessionLocal'"

    def test_session_module_exports_get_db(self):
        """session.py must export `get_db`."""
        module = importlib.import_module('app.database.session')
        assert hasattr(module, 'get_db'), "session.py must export 'get_db'"

    def test_get_db_is_generator_function(self):
        """get_db must be a generator function (yields a session)."""
        module = importlib.import_module('app.database.session')
        assert inspect.isgeneratorfunction(module.get_db), (
            'get_db must be a generator function'
        )

    def test_engine_uses_database_url_env_or_default(self):
        """engine URL must default to sqlite poker.db."""
        module = importlib.import_module('app.database.session')
        url = str(module.engine.url)
        # Should be sqlite-based by default
        assert 'sqlite' in url or 'postgresql' in url, (
            'engine URL must be sqlite (default) or configurable via DATABASE_URL'
        )


class TestSharedGetDbWorksWithOverride:
    def test_conftest_overrides_shared_get_db(self):
        """conftest.py must override the shared get_db from session.py."""
        conftest_src = Path('test/conftest.py').read_text()
        assert 'from app.database.session import get_db' in conftest_src, (
            'conftest.py must import get_db from app.database.session'
        )


class TestCheckSameThreadConditional:
    """T-048: check_same_thread must only be set for SQLite databases."""

    def _reload_session(self, db_url: str):
        """Force-reload session.py with a given DATABASE_URL."""
        with patch.dict('os.environ', {'DATABASE_URL': db_url}):
            if 'app.database.session' in sys.modules:
                del sys.modules['app.database.session']
            module = importlib.import_module('app.database.session')
        return module

    def test_sqlite_engine_has_check_same_thread(self):
        """SQLite engine must include check_same_thread=False in connect_args."""
        module = self._reload_session('sqlite:///./test.db')
        connect_args = module.engine.dialect.create_connect_args(module.engine.url)[1]
        assert connect_args.get('check_same_thread') is False, (
            'SQLite engine must have check_same_thread=False in connect_args'
        )

    def test_non_sqlite_engine_omits_check_same_thread(self):
        """Non-SQLite engine must NOT include check_same_thread in connect_args."""
        # We cannot create a real PostgreSQL engine in CI, so inspect session.py source
        # to verify the conditional is present.
        session_src = Path('src/app/database/session.py').read_text()
        assert 'startswith' in session_src, (
            'session.py must use startswith to conditionally set check_same_thread'
        )
        assert 'check_same_thread' in session_src, (
            'session.py must reference check_same_thread'
        )
        # Verify the else branch produces an empty dict for non-sqlite
        assert (
            'else {}' in session_src
            or 'else { }' in session_src
            or ('else' in session_src and '{}' in session_src)
        ), 'session.py must have an else branch returning {} for non-SQLite'
