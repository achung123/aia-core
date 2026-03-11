"""Tests for T-039: Image Upload endpoint (POST /games/{game_id}/hands/image)."""

import glob
import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import Base as ModelsBase
from app.database.session import get_db
from app.main import app

DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    LegacyBase.metadata.create_all(bind=engine)
    ModelsBase.metadata.create_all(bind=engine)
    yield
    ModelsBase.metadata.drop_all(bind=engine)
    LegacyBase.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    """Create a game session and return its ID."""
    response = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Adam', 'Gil']},
    )
    assert response.status_code == 201
    return response.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    """Minimal valid JPEG header + padding."""
    # JPEG magic bytes: FF D8 FF
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


def _make_png(size_bytes: int = 100) -> bytes:
    """Minimal valid PNG header + padding."""
    # PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    return b'\x89PNG\r\n\x1a\n' + b'\x00' * (size_bytes - 8)


class TestImageUploadSuccess:
    def test_upload_jpeg_returns_201(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert response.status_code == 201

    def test_upload_png_returns_201(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.png', _make_png(), 'image/png')},
        )
        assert response.status_code == 201

    def test_upload_returns_upload_id(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        data = response.json()
        assert 'upload_id' in data
        assert isinstance(data['upload_id'], int)
        assert data['upload_id'] > 0

    def test_upload_returns_status_processing(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        data = response.json()
        assert data['status'] == 'processing'

    def test_upload_returns_game_id(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        data = response.json()
        assert data['game_id'] == game_id

    def test_upload_returns_file_path(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        data = response.json()
        assert 'file_path' in data
        assert str(game_id) in data['file_path']

    def test_upload_filename_in_path(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        data = response.json()
        assert 'hand.jpg' in data['file_path']


class TestImageUploadValidation:
    def test_unsupported_file_type_returns_415(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.gif', b'GIF89a\x00', 'image/gif')},
        )
        assert response.status_code == 415

    def test_unsupported_content_type_returns_415(self, client, game_id):
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.txt', b'just text', 'text/plain')},
        )
        assert response.status_code == 415

    def test_file_too_large_returns_413(self, client, game_id):
        # 10MB + 1 byte
        big_file = _make_jpeg(10 * 1024 * 1024 + 1)
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('big.jpg', big_file, 'image/jpeg')},
        )
        assert response.status_code == 413

    def test_file_at_exact_limit_returns_201(self, client, game_id):
        # Exactly 10MB — should pass
        exact_file = _make_jpeg(10 * 1024 * 1024)
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('exact.jpg', exact_file, 'image/jpeg')},
        )
        assert response.status_code == 201

    def test_game_not_found_returns_404(self, client):
        response = client.post(
            '/games/999/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert response.status_code == 404


class TestImageUploadPathTraversal:
    """Security tests: path traversal prevention (OWASP A01)."""

    def test_path_traversal_filename_is_rejected_or_sanitized(self, client, game_id):
        """Filenames with directory separators must not escape uploads/ directory."""
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('../../etc/cron.d/evil', _make_jpeg(), 'image/jpeg')},
        )
        # Either the request is rejected, or the stored path stays inside uploads/
        if response.status_code == 201:
            file_path = response.json()['file_path']
            assert '..' not in file_path, 'Path traversal sequence must not appear in stored path'
            assert file_path.startswith('uploads/'), 'Stored path must remain inside uploads/'

    def test_path_traversal_filename_basename_only(self, client, game_id):
        """Only the basename of the filename should be used for storage."""
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('../../evil.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert response.status_code == 201
        file_path = response.json()['file_path']
        assert '..' not in file_path
        assert file_path.startswith('uploads/')
        assert 'evil.jpg' in file_path

    def test_absolute_path_filename_is_sanitized(self, client, game_id):
        """Absolute path filename must not escape the uploads/ directory."""
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('/etc/passwd', _make_jpeg(), 'image/jpeg')},
        )
        assert response.status_code == 201
        file_path = response.json()['file_path']
        assert not file_path.startswith('/etc/'), 'Absolute path must not be stored outside uploads/'
        assert file_path.startswith('uploads/')


class TestImageUploadNoDuplicateOverwrite:
    """Regression tests: duplicate uploads with same filename must not overwrite (aia-core-6il)."""

    def test_two_uploads_same_filename_get_unique_paths(self, client, game_id):
        """Two uploads with the same filename should be stored at different paths."""
        r1 = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        r2 = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()['file_path'] != r2.json()['file_path']

    def test_two_uploads_same_filename_get_different_upload_ids(self, client, game_id):
        """Two uploads with the same filename should produce distinct upload_id values."""
        r1 = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        r2 = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        assert r1.json()['upload_id'] != r2.json()['upload_id']

    def test_upload_id_embedded_in_file_path(self, client, game_id):
        """The stored file_path must include the upload_id to guarantee uniqueness."""
        response = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        data = response.json()
        upload_id = str(data['upload_id'])
        assert upload_id in data['file_path'], (
            f'upload_id {upload_id} must appear in file_path {data["file_path"]!r}'
        )


class TestImageUploadErrorCleanup:
    """Error-path cleanup: orphaned tmp/final files must not be left on disk."""

    def test_rename_failure_removes_tmp_file(self, client, game_id):
        """If os.rename() raises, the written tmp file must be cleaned up."""
        before = set(glob.glob(f'uploads/{game_id}/tmp_*'))

        with patch('app.routes.images.os.rename', side_effect=OSError('cross-device link')):
            response = client.post(
                f'/games/{game_id}/hands/image',
                files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
            )

        assert response.status_code == 500
        after = set(glob.glob(f'uploads/{game_id}/tmp_*'))
        new_tmp_files = after - before
        assert new_tmp_files == set(), f'Orphaned tmp files left on disk: {new_tmp_files}'

    def test_commit_failure_removes_final_file(self, client, game_id):
        """If db.commit() raises after rename, the final file must be removed."""
        from sqlalchemy.orm import Session

        existing_files = set(glob.glob(f'uploads/{game_id}/*'))

        with patch.object(Session, 'commit', side_effect=Exception('DB error')):
            response = client.post(
                f'/games/{game_id}/hands/image',
                files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
            )

        assert response.status_code == 500
        remaining_files = set(glob.glob(f'uploads/{game_id}/*'))
        new_files = remaining_files - existing_files
        assert new_files == set(), f'Orphaned final files left on disk: {new_files}'
