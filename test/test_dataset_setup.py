"""Tests for T-002: Source and prepare card detection dataset."""

import ast
import os
import subprocess
import sys

import yaml
import pytest


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class TestGitignore:
    """AC-5: data/ is added to .gitignore."""

    def test_gitignore_contains_data(self):
        gitignore_path = os.path.join(PROJECT_ROOT, ".gitignore")
        assert os.path.exists(gitignore_path), ".gitignore must exist"
        with open(gitignore_path) as f:
            lines = [line.strip() for line in f.readlines()]
        assert any(
            line in ("data/", "data") for line in lines
        ), ".gitignore must contain 'data/' entry"


class TestDownloadScript:
    """Download script exists and is valid Python."""

    def test_script_exists(self):
        script = os.path.join(PROJECT_ROOT, "scripts", "download_dataset.py")
        assert os.path.isfile(script), "scripts/download_dataset.py must exist"

    def test_script_is_valid_python(self):
        script = os.path.join(PROJECT_ROOT, "scripts", "download_dataset.py")
        with open(script) as f:
            source = f.read()
        # Should parse without syntax errors
        ast.parse(source)

    def test_script_has_main_guard(self):
        script = os.path.join(PROJECT_ROOT, "scripts", "download_dataset.py")
        with open(script) as f:
            source = f.read()
        assert 'if __name__' in source, "Script must have if __name__ == '__main__' guard"

    def test_script_imports_roboflow(self):
        script = os.path.join(PROJECT_ROOT, "scripts", "download_dataset.py")
        with open(script) as f:
            source = f.read()
        assert "roboflow" in source.lower(), "Script must reference roboflow SDK"


class TestDataYaml:
    """AC-3: data/cards/data.yaml with correct structure."""

    @pytest.fixture
    def data_yaml(self):
        path = os.path.join(PROJECT_ROOT, "data", "cards", "data.yaml")
        assert os.path.isfile(path), "data/cards/data.yaml must exist"
        with open(path) as f:
            return yaml.safe_load(f)

    def test_data_yaml_has_required_keys(self, data_yaml):
        for key in ("path", "train", "val", "test", "nc", "names"):
            assert key in data_yaml, f"data.yaml must contain '{key}' key"

    def test_nc_is_52(self, data_yaml):
        assert data_yaml["nc"] == 52, "nc must be 52 (one per card)"

    def test_names_has_52_entries(self, data_yaml):
        names = data_yaml["names"]
        assert len(names) == 52, f"names must have 52 entries, got {len(names)}"

    def test_split_paths(self, data_yaml):
        assert "train" in data_yaml["train"]
        assert "val" in data_yaml["val"] or "valid" in data_yaml["val"]
        assert "test" in data_yaml["test"]


class TestDataReadme:
    """AC-4: data/cards/README.md with documentation."""

    @pytest.fixture
    def readme_content(self):
        path = os.path.join(PROJECT_ROOT, "data", "cards", "README.md")
        assert os.path.isfile(path), "data/cards/README.md must exist"
        with open(path) as f:
            return f.read()

    def test_documents_source_url(self, readme_content):
        assert (
            "universe.roboflow.com/augmented-startups/playing-cards-ow27d"
            in readme_content
        ), "README must document source URL"

    def test_documents_license(self, readme_content):
        assert "license" in readme_content.lower(), "README must mention license"

    def test_documents_image_count(self, readme_content):
        assert "image" in readme_content.lower(), "README must mention image count"

    def test_documents_class_info(self, readme_content):
        assert "52" in readme_content, "README must mention 52 classes"
