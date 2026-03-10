"""Tests for FastAPI router structure refactoring."""

import importlib
from pathlib import Path

from fastapi import FastAPI
from fastapi.routing import APIRouter


def test_new_router_files_exist():
    """Verify all 6 new router files exist."""
    routes_dir = Path('src/app/routes')
    expected_files = [
        'games.py',
        'hands.py',
        'players.py',
        'upload.py',
        'stats.py',
        'search.py',
    ]

    for filename in expected_files:
        file_path = routes_dir / filename
        assert file_path.exists(), f'Router file {filename} does not exist'


def test_each_router_has_api_router_instance():
    """Verify each new router file has an APIRouter instance."""
    router_modules = [
        'app.routes.games',
        'app.routes.hands',
        'app.routes.players',
        'app.routes.upload',
        'app.routes.stats',
        'app.routes.search',
    ]

    for module_name in router_modules:
        # Import the module
        module = importlib.import_module(module_name)

        # Check it has a 'router' attribute
        assert hasattr(module, 'router'), (
            f"{module_name} does not have a 'router' attribute"
        )

        # Check the router is an APIRouter instance
        router = module.router
        assert isinstance(router, APIRouter), (
            f'{module_name}.router is not an APIRouter instance'
        )


def test_main_app_includes_all_routers():
    """Verify main.py includes all the new routers."""

    # Get all registered routers from the app
    # FastAPI stores routers in the app.routes, even if they're empty
    # We check that the routers are actually imported and included
    expected_routers = [
        'games',
        'hands',
        'players',
        'upload',
        'stats',
        'search',
    ]

    # Read the main.py source to verify imports and includes
    from pathlib import Path

    main_py = Path('src/app/main.py').read_text()

    # Check that each router is imported
    for router_name in expected_routers:
        assert router_name in main_py, f"Router '{router_name}' not imported in main.py"
        assert f'{router_name}.router' in main_py, (
            f"Router '{router_name}.router' not included in main.py"
        )


def test_app_instance_is_fastapi():
    """Verify the app is a FastAPI instance."""
    from app.main import app

    assert isinstance(app, FastAPI), 'app.main.app is not a FastAPI instance'


def test_old_game_router_still_exists():
    """Verify the old game.py router is still present (temporary)."""
    game_router_path = Path('src/app/routes/game.py')
    assert game_router_path.exists(), (
        'Old game.py router should still exist temporarily'
    )
