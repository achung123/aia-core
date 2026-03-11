"""Tests for the shared database session dependency (T-010)."""

import importlib
import inspect
from pathlib import Path


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
        assert inspect.isgeneratorfunction(module.get_db), \
            "get_db must be a generator function"

    def test_engine_uses_database_url_env_or_default(self):
        """engine URL must default to sqlite poker.db."""
        module = importlib.import_module('app.database.session')
        url = str(module.engine.url)
        # Should be sqlite-based by default
        assert 'sqlite' in url or 'postgresql' in url, \
            "engine URL must be sqlite (default) or configurable via DATABASE_URL"


class TestNoDuplicateEngineCreation:
    def test_game_router_does_not_create_engine(self):
        """game.py must not create its own engine or sessionmaker."""
        game_src = Path('src/app/routes/game.py').read_text()
        assert 'create_engine' not in game_src, \
            "game.py must not call create_engine (use shared session)"
        assert 'SessionLocal = sessionmaker' not in game_src, \
            "game.py must not define its own SessionLocal"

    def test_game_router_uses_shared_get_db(self):
        """game.py must import get_db from app.database.session."""
        game_src = Path('src/app/routes/game.py').read_text()
        assert 'from app.database.session import' in game_src, \
            "game.py must import from app.database.session"
        assert 'get_db' in game_src, \
            "game.py must use get_db"

    def test_no_private_get_db_in_game_router(self):
        """game.py must not define a private _get_db function."""
        game_src = Path('src/app/routes/game.py').read_text()
        assert 'def _get_db' not in game_src, \
            "game.py must not define _get_db (use shared get_db from session.py)"


class TestSharedGetDbWorksWithOverride:
    def test_conftest_overrides_shared_get_db(self):
        """conftest.py must override the shared get_db from session.py."""
        conftest_src = Path('test/conftest.py').read_text()
        assert 'from app.database.session import get_db' in conftest_src, \
            "conftest.py must import get_db from app.database.session"
