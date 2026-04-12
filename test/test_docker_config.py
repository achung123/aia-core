"""Tests for Docker configuration files (frontend/Dockerfile, docker-compose.yml)."""

import pathlib

import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent


class TestDockerCompose:
    """Verify docker-compose.yml frontend service configuration."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.frontend = self.compose['services']['frontend']

    def test_frontend_volumes_include_vite_config_ts(self):
        volumes = self.frontend['volumes']
        assert any('vite.config.ts' in v for v in volumes), (
            'vite.config.ts must be mounted as a volume'
        )

    def test_frontend_volumes_include_tsconfig(self):
        volumes = self.frontend['volumes']
        assert any('tsconfig.json' in v for v in volumes), (
            'tsconfig.json must be mounted as a volume'
        )

    def test_frontend_volumes_do_not_reference_vite_config_js(self):
        volumes = self.frontend['volumes']
        assert not any('vite.config.js' in v for v in volumes), (
            'vite.config.js is obsolete — should be vite.config.ts'
        )

    def test_frontend_volume_targets_exist(self):
        """Every host-side path in frontend volumes should exist on disk."""
        volumes = self.frontend['volumes']
        for vol in volumes:
            host_path, _ = vol.split(':', 1)
            resolved = (ROOT / host_path.lstrip('./')).resolve()
            assert resolved.exists(), f'Volume host path does not exist: {host_path}'


class TestFrontendDockerfile:
    """Verify frontend/Dockerfile is suitable for the React+TS stack."""

    def setup_method(self):
        self.lines = (ROOT / 'frontend' / 'Dockerfile').read_text().splitlines()
        self.text = '\n'.join(self.lines)

    def test_npm_run_build_present(self):
        assert 'npm run build' in self.text, (
            "Dockerfile must include 'npm run build' to verify TypeScript compilation"
        )

    def test_no_preact_preset(self):
        assert '@preact/preset-vite' not in self.text, (
            'Dockerfile must not reference removed @preact/preset-vite'
        )

    def test_exposes_5173(self):
        assert any('EXPOSE' in line and '5173' in line for line in self.lines)

    def test_node_base_image(self):
        assert any(line.startswith('FROM node:') for line in self.lines)
