"""Tests for Docker configuration files (frontend/Dockerfile, docker-compose.yml)."""

import pathlib
import re

import pytest
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
PINNED_IMAGE_REF_RE = re.compile(r'[\w./-]+:[\w][\w.-]*@sha256:[0-9a-f]{64}')


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


class TestDockerBuildContextHygiene:
    """Verify image builds share a repo-root context with strict ignore rules."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']
        self.dockerignore_path = ROOT / '.dockerignore'

    def test_shared_compose_uses_repo_root_context_for_all_image_builds(self):
        for service_name in ['backend', 'backend-gpu', 'frontend']:
            build = self.services[service_name]['build']
            assert build['context'] == '.'

        assert self.services['frontend']['build']['dockerfile'] == 'frontend/Dockerfile'

    def test_repo_root_dockerignore_excludes_sensitive_and_runtime_paths(self):
        assert self.dockerignore_path.exists(), 'Repo root .dockerignore must exist'

        entries = _load_ignore_entries(self.dockerignore_path)

        for expected in [
            '.git/',
            '.env',
            '.env.*',
            '**/.env',
            '**/.env.*',
            '.venv/',
            '.pytest_cache/',
            '.ruff_cache/',
            'frontend/node_modules/',
            'frontend/dist/',
            'backend/poker.db',
            'backend/uploads/',
            'npm_data/',
            'npm_letsencrypt/',
            'scripts/docker/certs/',
        ]:
            assert expected in entries


class TestProxyTlsTermination:
    """Verify shared ingress terminates TLS at the nginx edge."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.proxy = self.compose['services']['proxy']
        self.proxy_text = (ROOT / 'scripts' / 'docker' / 'proxy.conf').read_text()
        self.network_docs = (ROOT / 'docs' / 'local-network-setup.md').read_text()
        self.share_script = (ROOT / 'scripts' / 'docker' / 'share.sh').read_text()
        self.unshare_script = (ROOT / 'scripts' / 'docker' / 'unshare.sh').read_text()

    def test_proxy_publishes_https_and_mounts_tls_material(self):
        assert self.proxy['ports'] == ['80:80', '443:443']

        mounts = {
            container_path: (host_path, mode)
            for host_path, container_path, mode in map(
                _split_volume, self.proxy['volumes']
            )
        }
        assert mounts['/etc/nginx/conf.d/default.conf'] == (
            './scripts/docker/proxy.conf',
            'ro',
        )
        assert mounts['/etc/nginx/certs/aia.local.pem'] == (
            './scripts/docker/certs/aia.local.pem',
            'ro',
        )
        assert mounts['/etc/nginx/certs/aia.local-key.pem'] == (
            './scripts/docker/certs/aia.local-key.pem',
            'ro',
        )

    def test_proxy_redirects_http_to_https(self):
        assert 'listen 80;' in self.proxy_text
        assert 'return 301 https://$host$request_uri;' in self.proxy_text

    def test_proxy_serves_tls_with_local_cert_paths_and_hsts(self):
        assert 'listen 443 ssl;' in self.proxy_text
        assert 'ssl_certificate /etc/nginx/certs/aia.local.pem;' in self.proxy_text
        assert (
            'ssl_certificate_key /etc/nginx/certs/aia.local-key.pem;' in self.proxy_text
        )
        assert (
            'add_header Strict-Transport-Security "max-age=86400" always;'
            in self.proxy_text
        )

    def test_docs_record_mkcert_dev_flow_and_acme_prod_path(self):
        assert 'mkcert -install' in self.network_docs
        assert (
            'mkcert -key-file scripts/docker/certs/aia.local-key.pem'
            in self.network_docs
        )
        assert 'ACME' in self.network_docs
        assert 'install the mkcert root CA on each client device' in self.network_docs

    def test_docs_no_longer_advertise_a_plaintext_aia_local_origin(self):
        assert 'http://aia.local' not in self.network_docs

    def test_wsl_sharing_forwards_https_and_cleans_up_firewall_rules(self):
        assert (
            'listenport=443 connectaddress=$WSL_IP connectport=443' in self.share_script
        )
        assert 'netsh advfirewall firewall add rule name=AIA-HTTPS' in self.share_script
        assert 'rule name=AIA-HTTPS' in self.unshare_script


class TestDocsReflectProxyOnlySharing:
    """Verify operator docs match the hardened proxy-only sharing flow."""

    def setup_method(self):
        self.readme = (ROOT / 'README.md').read_text()
        self.deployment_docs = (ROOT / 'docs' / 'deployment.md').read_text()

    def test_readme_lan_guidance_uses_proxy_https_entrypoint(self):
        assert 'http://<host-ip>' not in self.readme
        assert 'https://aia.local' in self.readme

    def test_deployment_docs_do_not_advertise_direct_frontend_backend_ports(self):
        assert 'LocalPort 5173' not in self.deployment_docs
        assert 'LocalPort 8000' not in self.deployment_docs
        assert 'Add inbound rules for 5173 and 8000' not in self.deployment_docs
        assert 'https://aia.local' in self.deployment_docs

    def test_forwarded_header_boundary_is_documented_for_shared_and_dev_paths(self):
        assert '172.29.0.2' in self.deployment_docs
        assert 'UVICORN_FORWARDED_ALLOW_IPS' in self.deployment_docs
        assert 'UVICORN_PROXY_HEADERS=0' in self.deployment_docs

    def test_deployment_docs_document_explicit_migration_startup_path(self):
        assert 'RUN_DB_MIGRATIONS' in self.deployment_docs
        assert 'AIA_RUN_DB_MIGRATIONS=1 docker compose --profile cpu up backend' in (
            self.deployment_docs
        )
        assert 'docker compose run --rm -e RUN_DB_MIGRATIONS=1 backend' in (
            self.deployment_docs
        )


class TestBackendIngressHardening:
    """Verify backend ingress stays behind the proxy in shared compose config."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']

    @pytest.mark.parametrize('service_name', ['backend', 'backend-gpu'])
    def test_backend_services_are_not_published_to_the_host(self, service_name):
        service = self.services[service_name]
        assert 'ports' not in service
        assert service['expose'] == ['8000']

    def test_dev_override_restores_direct_backend_access_and_reload(self):
        with open(ROOT / 'docker-compose.dev.yml') as f:
            compose = yaml.safe_load(f)

        for service_name in ['backend', 'backend-gpu']:
            service = compose['services'][service_name]
            assert service['ports'] == ['127.0.0.1:8000:8000']
            assert 'UVICORN_RELOAD=1' in service['environment']
            assert 'UVICORN_PROXY_HEADERS=0' in service['environment']

    def test_aia_local_origin_uses_https_in_shared_and_dev_compose(self):
        with open(ROOT / 'docker-compose.dev.yml') as f:
            dev_compose = yaml.safe_load(f)

        for compose in [self.compose, dev_compose]:
            for service_name in ['backend', 'backend-gpu']:
                environment = compose['services'][service_name]['environment']
                allowed_origins = next(
                    entry.removeprefix('ALLOWED_ORIGINS=')
                    for entry in environment
                    if entry.startswith('ALLOWED_ORIGINS=')
                )
                assert 'https://aia.local' in allowed_origins
                assert 'http://aia.local' not in allowed_origins

    def test_shared_compose_parameterizes_allowed_origins_to_the_tls_edge_origin(self):
        for service_name in ['backend', 'backend-gpu']:
            environment = self.compose['services'][service_name]['environment']
            allowed_origins = next(
                entry.removeprefix('ALLOWED_ORIGINS=')
                for entry in environment
                if entry.startswith('ALLOWED_ORIGINS=')
            )
            assert allowed_origins == '${AIA_SHARED_ALLOWED_ORIGINS:-https://aia.local}'

    def test_dev_override_parameterizes_local_debug_origins_without_0_0_0_0(self):
        with open(ROOT / 'docker-compose.dev.yml') as f:
            dev_compose = yaml.safe_load(f)

        expected = (
            '${AIA_DEV_ALLOWED_ORIGINS:-http://localhost:5173,'
            'http://127.0.0.1:5173,https://aia.local}'
        )

        for service_name in ['backend', 'backend-gpu']:
            environment = dev_compose['services'][service_name]['environment']
            allowed_origins = next(
                entry.removeprefix('ALLOWED_ORIGINS=')
                for entry in environment
                if entry.startswith('ALLOWED_ORIGINS=')
            )
            assert allowed_origins == expected

    def test_shared_compose_assigns_a_stable_internal_proxy_ip_for_forwarded_trust(
        self,
    ):
        proxy_network = self.services['proxy']['networks']['internal']
        backend_network = self.services['backend']['networks']['internal']
        backend_gpu_network = self.services['backend-gpu']['networks']['internal']
        internal_network = self.compose['networks']['internal']

        assert proxy_network['ipv4_address'] == '172.29.0.2'
        assert backend_network['ipv4_address'] == '172.29.0.3'
        assert backend_gpu_network['ipv4_address'] == '172.29.0.4'
        assert internal_network['ipam']['config'] == [{'subnet': '172.29.0.0/24'}]
        assert (
            len(
                {
                    proxy_network['ipv4_address'],
                    backend_network['ipv4_address'],
                    backend_gpu_network['ipv4_address'],
                }
            )
            == 3
        )

        for service_name in ['backend', 'backend-gpu']:
            environment = self.services[service_name]['environment']
            trusted_proxy_ips = next(
                entry.removeprefix('UVICORN_FORWARDED_ALLOW_IPS=')
                for entry in environment
                if entry.startswith('UVICORN_FORWARDED_ALLOW_IPS=')
            )
            assert trusted_proxy_ips == '${AIA_TRUSTED_PROXY_IPS:-172.29.0.2}'

    def test_shared_and_dev_compose_keep_startup_migrations_opt_in(self):
        with open(ROOT / 'docker-compose.dev.yml') as f:
            dev_compose = yaml.safe_load(f)

        for compose in [self.compose, dev_compose]:
            for service_name in ['backend', 'backend-gpu']:
                environment = compose['services'][service_name]['environment']
                run_db_migrations = next(
                    entry.removeprefix('RUN_DB_MIGRATIONS=')
                    for entry in environment
                    if entry.startswith('RUN_DB_MIGRATIONS=')
                )
                assert run_db_migrations == '${AIA_RUN_DB_MIGRATIONS:-0}'


class TestFrontendIngressHardening:
    """Verify frontend ingress stays proxy-only in shared compose config."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.frontend = self.compose['services']['frontend']
        self.proxy_text = (ROOT / 'scripts' / 'docker' / 'proxy.conf').read_text()

    def test_frontend_service_is_not_published_to_the_host(self):
        assert 'ports' not in self.frontend

    def test_dev_override_restores_loopback_only_frontend_debug_access(self):
        with open(ROOT / 'docker-compose.dev.yml') as f:
            compose = yaml.safe_load(f)

        frontend = compose['services']['frontend']
        assert frontend['ports'] == ['127.0.0.1:5173:5173']

    def test_proxy_routes_root_traffic_to_frontend_upstream(self):
        assert 'upstream frontend {' in self.proxy_text
        assert re.search(
            r'location / \{[^}]*proxy_pass http://frontend;',
            self.proxy_text,
            re.DOTALL,
        )

    def test_proxy_normalizes_frontend_host_header_for_internal_vite_upstream(self):
        assert re.search(
            r'location / \{[^}]*proxy_set_header Host frontend;',
            self.proxy_text,
            re.DOTALL,
        )


class TestViteDevServerHardening:
    """Verify Vite dev server only serves expected hosts and files."""

    def setup_method(self):
        self.text = (ROOT / 'frontend' / 'vite.config.ts').read_text()

    def test_vite_uses_explicit_allowed_hosts_for_proxy_and_loopback_debug(self):
        assert 'allowedHosts: true' not in self.text
        assert 'allowedHosts:' in self.text
        for host in ['frontend', 'localhost', '127.0.0.1']:
            assert f"'{host}'" in self.text

    def test_vite_uses_strict_filesystem_serving_with_an_explicit_allowlist(self):
        assert 'fs:' in self.text
        assert 'strict: true' in self.text
        assert 'allow:' in self.text


def _load_ignore_entries(path: pathlib.Path) -> set[str]:
    return {
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip() and not line.lstrip().startswith('#')
    }


def _parse_memory_limit(meg_or_gig: str) -> int:
    match = re.fullmatch(r'(\d+)([mg])', meg_or_gig.lower())
    assert match is not None, f'Unsupported memory limit format: {meg_or_gig}'
    value = int(match.group(1))
    unit = match.group(2)
    return value if unit == 'm' else value * 1024


def _split_volume(volume: str) -> tuple[str, str, str | None]:
    parts = volume.split(':')
    if len(parts) == 2:
        host_path, container_path = parts
        return host_path, container_path, None
    if len(parts) == 3:
        host_path, container_path, mode = parts
        return host_path, container_path, mode
    raise AssertionError(f'Unsupported volume format: {volume}')


def _assert_image_ref_is_pinned(image_ref: str):
    assert 'latest' not in image_ref
    assert PINNED_IMAGE_REF_RE.fullmatch(image_ref), (
        'Image references must use an explicit version tag plus sha256 digest: '
        f'{image_ref}'
    )


def _extract_dockerfile_image_refs(text: str) -> list[str]:
    from_refs = re.findall(r'^\s*FROM\s+([^\s]+)', text, re.MULTILINE)
    copy_from_refs = re.findall(
        r'^\s*COPY\s+--from=([^\s]+)\s',
        text,
        re.MULTILINE,
    )
    return [*from_refs, *copy_from_refs]


class TestComposeResourceLimits:
    """Verify compose services have explicit operational limits."""

    def setup_method(self):
        self.compose_path = ROOT / 'docker-compose.yml'
        self.text = self.compose_path.read_text()
        with open(self.compose_path) as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']

    @pytest.mark.parametrize(
        'service_name',
        ['mdns', 'proxy', 'backend', 'backend-gpu', 'frontend'],
    )
    def test_every_long_running_service_declares_resource_limits(self, service_name):
        service = self.services[service_name]

        assert _parse_memory_limit(service['mem_limit']) > 0
        assert float(service['cpus']) > 0
        assert service['pids_limit'] > 0

    def test_gpu_backend_keeps_gpu_reservation_and_has_higher_limits_than_cpu_backend(
        self,
    ):
        backend = self.services['backend']
        backend_gpu = self.services['backend-gpu']

        assert _parse_memory_limit(backend_gpu['mem_limit']) > _parse_memory_limit(
            backend['mem_limit']
        )
        assert float(backend_gpu['cpus']) > float(backend['cpus'])
        assert backend_gpu['pids_limit'] > backend['pids_limit']

        assert backend_gpu['deploy']['resources']['reservations']['devices'] == [
            {
                'driver': 'nvidia',
                'count': 1,
                'capabilities': ['gpu'],
            }
        ]

    def test_compose_records_the_resource_limit_baseline_for_future_tuning(self):
        assert '# Resource cap baselines for trivial host-DoS protection.' in self.text
        assert (
            '# GPU profile keeps its NVIDIA reservation and gets higher ceilings.'
            in self.text
        )


class TestComposeLoggingPolicy:
    """Verify compose services use bounded, consistent container logs."""

    def setup_method(self):
        self.compose_path = ROOT / 'docker-compose.yml'
        with open(self.compose_path) as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']

    @pytest.mark.parametrize(
        'service_name',
        ['mdns', 'proxy', 'backend', 'backend-gpu', 'frontend'],
    )
    def test_every_long_running_service_declares_bounded_json_file_logging(
        self, service_name
    ):
        logging = self.services[service_name].get('logging')

        assert logging == {
            'driver': 'json-file',
            'options': {
                'max-size': '10m',
                'max-file': '5',
            },
        }


class TestMdnsHardening:
    """Verify the mdns service keeps host networking on the tightest leash."""

    def setup_method(self):
        self.compose_path = ROOT / 'docker-compose.yml'
        self.text = self.compose_path.read_text()
        with open(self.compose_path) as f:
            self.compose = yaml.safe_load(f)
        self.mdns = self.compose['services']['mdns']
        self.network_docs = (ROOT / 'docs' / 'local-network-setup.md').read_text()

    def test_mdns_image_is_versioned_and_digest_pinned(self):
        assert re.fullmatch(
            r'[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}',
            self.mdns['image'],
        )

    def test_mdns_host_networking_is_bounded_by_runtime_hardening(self):
        assert self.mdns['network_mode'] == 'host'
        assert self.mdns['hostname'] == 'aia'
        assert self.mdns['security_opt'] == ['no-new-privileges:true']
        assert self.mdns['read_only'] is True
        assert any(
            entry.startswith('/run/avahi-daemon') for entry in self.mdns['tmpfs']
        )
        assert self.mdns['cap_drop'] == ['ALL']
        assert set(self.mdns['cap_add']) == {'SETGID', 'SETUID'}

    def test_mdns_mounts_a_version_controlled_service_definition(self):
        assert any(
            container_path == '/etc/avahi/services/aia.service' and mode == 'ro'
            for _host_path, container_path, mode in map(
                _split_volume, self.mdns['volumes']
            )
        )

    def test_mdns_runs_avahi_without_chroot_under_hardened_runtime(self):
        assert self.mdns['command'] == ['avahi-daemon', '--no-chroot']

    def test_docs_record_why_udp_5353_publishing_does_not_replace_host_networking(
        self,
    ):
        assert 'publishing UDP 5353' in self.network_docs
        assert 'host networking' in self.network_docs


class TestComposeProjectScoping:
    """Verify shared compose config uses Compose-managed names without overclaiming host-resource isolation."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']
        self.network_docs = (ROOT / 'docs' / 'local-network-setup.md').read_text()

    def test_services_do_not_hard_code_container_names(self):
        for service_name, service in self.services.items():
            assert 'container_name' not in service, (
                f'{service_name} should rely on compose project-scoped naming'
            )

    def test_local_network_docs_limit_project_scoping_to_compose_managed_names(
        self,
    ):
        assert 'docker compose -p' in self.network_docs
        assert (
            'Docker Compose prefixes runtime container names with the project name'
            in self.network_docs
        )
        assert 'published host ports 80/443' in self.network_docs
        assert 'host-network' in self.network_docs
        assert '`mdns` service' in self.network_docs


class TestComposeNetworkSegmentation:
    """Verify shared compose networking is explicitly segmented by traffic role."""

    def setup_method(self):
        self.compose_path = ROOT / 'docker-compose.yml'
        with open(self.compose_path) as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']
        self.networks = self.compose['networks']
        self.network_docs = (ROOT / 'docs' / 'local-network-setup.md').read_text()
        self.deployment_docs = (ROOT / 'docs' / 'deployment.md').read_text()

    def test_compose_declares_edge_and_internal_networks(self):
        assert set(self.networks) == {'edge', 'internal'}
        assert self.networks['internal']['ipam']['config'] == [
            {'subnet': '172.29.0.0/24'}
        ]

    def test_services_attach_only_to_minimum_required_networks(self):
        assert self.services['proxy']['networks'] == {
            'edge': None,
            'internal': {'ipv4_address': '172.29.0.2'},
        }
        assert self.services['frontend']['networks'] == ['edge']
        assert self.services['backend']['networks'] == {
            'internal': {'ipv4_address': '172.29.0.3'}
        }
        assert self.services['backend-gpu']['networks'] == {
            'internal': {'ipv4_address': '172.29.0.4', 'aliases': ['backend']}
        }
        assert 'networks' not in self.services['mdns']

    def test_proxy_shared_attachments_preserve_frontend_and_backend_routing(self):
        proxy_networks = self.services['proxy']['networks']

        assert 'edge' in proxy_networks
        assert proxy_networks['internal']['ipv4_address'] == '172.29.0.2'

    def test_docs_describe_the_segmented_proxy_topology(self):
        assert 'explicit `edge` and `internal` networks' in self.deployment_docs
        assert '`edge` network: nginx <-> frontend:5173' in self.deployment_docs
        assert '`internal` network: nginx <-> backend:8000' in self.deployment_docs
        assert '`frontend -> backend`' not in self.deployment_docs
        assert 'Bridges the `edge` and `internal` compose networks' in self.network_docs


class TestContainerUserHardening:
    """Verify compose and Dockerfiles enforce the non-root runtime contract."""

    def setup_method(self):
        self.compose_path = ROOT / 'docker-compose.yml'
        with open(self.compose_path) as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']

    @pytest.mark.parametrize(
        ('service_name', 'expected_context'),
        [
            ('backend', '.'),
            ('backend-gpu', '.'),
            ('frontend', '.'),
        ],
    )
    def test_app_services_pass_uid_gid_build_args(self, service_name, expected_context):
        build = self.services[service_name]['build']

        assert build['context'] == expected_context
        assert build['args'] == {
            'APP_UID': '${AIA_UID:-1000}',
            'APP_GID': '${AIA_GID:-1000}',
        }

    @pytest.mark.parametrize('service_name', ['backend', 'backend-gpu', 'frontend'])
    def test_app_services_disable_privilege_escalation(self, service_name):
        service = self.services[service_name]

        assert service['security_opt'] == ['no-new-privileges:true']
        assert '/tmp' in service['tmpfs']

    @pytest.mark.parametrize('service_name', ['backend', 'backend-gpu'])
    def test_backend_services_use_read_only_root_filesystems(self, service_name):
        service = self.services[service_name]

        assert service['read_only'] is True

    @pytest.mark.parametrize(
        ('service_name', 'readonly_mounts'),
        [
            (
                'backend',
                [
                    './backend/src',
                    './backend/alembic',
                    './backend/alembic.ini',
                    './backend/pyproject.toml',
                    './backend/uv.lock',
                    './scripts/docker/docker-entrypoint.sh',
                    './scripts',
                    './backend/models',
                ],
            ),
            (
                'backend-gpu',
                [
                    './backend/src',
                    './backend/alembic',
                    './backend/alembic.ini',
                    './backend/pyproject.toml',
                    './backend/uv.lock',
                    './scripts/docker/docker-entrypoint.sh',
                    './scripts',
                    './backend/models',
                ],
            ),
            (
                'frontend',
                [
                    './frontend/src',
                    './frontend/index.html',
                    './frontend/public',
                    './frontend/vite.config.ts',
                    './frontend/tsconfig.json',
                ],
            ),
        ],
    )
    def test_source_and_config_mounts_are_read_only(
        self, service_name, readonly_mounts
    ):
        mounts = {
            host_path: mode
            for host_path, _container_path, mode in map(
                _split_volume, self.services[service_name]['volumes']
            )
        }

        for host_path in readonly_mounts:
            assert mounts[host_path] == 'ro'

    @pytest.mark.parametrize('service_name', ['backend', 'backend-gpu'])
    def test_backend_data_mounts_remain_writable(self, service_name):
        mounts = {
            host_path: mode
            for host_path, _container_path, mode in map(
                _split_volume, self.services[service_name]['volumes']
            )
        }

        assert './backend/poker.db' not in mounts
        assert mounts['poker-data'] is None
        assert mounts['./backend/uploads'] is None


class TestSqlitePersistenceStrategy:
    """Verify SQLite persistence moves off the fragile file bind mount."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        with open(ROOT / 'docker-compose.dev.yml') as f:
            self.dev_compose = yaml.safe_load(f)
        self.deployment_docs = (ROOT / 'docs' / 'deployment.md').read_text()

    def test_compose_declares_a_named_volume_for_sqlite_data(self):
        assert 'poker-data' in self.compose['volumes']

    @pytest.mark.parametrize('service_name', ['backend', 'backend-gpu'])
    def test_shared_compose_mounts_sqlite_named_volume_at_managed_data_path(
        self, service_name
    ):
        mounts = {
            container_path: (host_path, mode)
            for host_path, container_path, mode in map(
                _split_volume, self.compose['services'][service_name]['volumes']
            )
        }

        assert mounts['/app/data'] == ('poker-data', None)
        assert ('./backend/poker.db', None) not in mounts.values()

    def test_shared_and_dev_compose_point_database_url_at_the_managed_path(self):
        expected = '${AIA_DATABASE_URL:-sqlite:////app/data/poker.db}'

        for compose in [self.compose, self.dev_compose]:
            for service_name in ['backend', 'backend-gpu']:
                environment = compose['services'][service_name]['environment']
                database_url = next(
                    entry.removeprefix('DATABASE_URL=')
                    for entry in environment
                    if entry.startswith('DATABASE_URL=')
                )
                assert database_url == expected

    def test_deployment_docs_cover_backup_restore_and_volume_permissions(self):
        assert 'named volume `poker-data`' in self.deployment_docs
        assert '/app/data/poker.db' in self.deployment_docs
        assert (
            'docker compose run --rm -T --entrypoint python -v "$PWD/backups:/backup" backend'
            in self.deployment_docs
        )
        assert 'restore a backup' in self.deployment_docs.lower()
        assert 'pre-creates `/app/data` as `app:app`' in self.deployment_docs


class TestProxyConfig:
    """Verify nginx owns the backend ingress path."""

    def setup_method(self):
        self.text = (ROOT / 'scripts' / 'docker' / 'proxy.conf').read_text()

    def test_proxy_defines_backend_upstream(self):
        assert 'upstream backend {' in self.text

    def test_proxy_disables_nginx_version_disclosure(self):
        assert re.search(r'^\s*server_tokens\s+off\s*;', self.text, re.MULTILINE)

    def test_proxy_exposes_api_route_to_backend(self):
        assert 'location /api/' in self.text
        assert 'proxy_pass http://backend;' in self.text

    @pytest.mark.parametrize(
        'api_prefix',
        [
            '/games',
            '/players',
            '/stats',
            '/upload',
            '/images',
            '/docs',
            '/openapi.json',
        ],
    )
    def test_proxy_routes_existing_api_prefixes_to_backend(self, api_prefix):
        assert f'location {api_prefix}' in self.text

    @pytest.mark.parametrize(
        'header_directive',
        [
            'add_header X-Frame-Options "DENY" always;',
            'add_header X-Content-Type-Options "nosniff" always;',
            'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
            'add_header Content-Security-Policy',
        ],
    )
    def test_proxy_sets_baseline_security_headers(self, header_directive):
        assert header_directive in self.text

    def test_proxy_defines_rate_limit_zone(self):
        assert 'limit_req_zone $binary_remote_addr zone=api_rate_limit:' in self.text

    @pytest.mark.parametrize(
        'api_prefix',
        [
            '/api/',
            '/games',
            '/players',
            '/stats',
            '/upload',
            '/images',
            '/docs',
            '/openapi.json',
        ],
    )
    def test_proxy_applies_rate_limiting_to_each_throttled_backend_prefix(
        self, api_prefix
    ):
        assert re.search(
            rf'location {re.escape(api_prefix)} \{{[^}}]*limit_req zone=api_rate_limit',
            self.text,
            re.DOTALL,
        )

    @pytest.mark.parametrize(
        'timeout_directive',
        [
            'client_header_timeout',
            'client_body_timeout',
            'proxy_connect_timeout',
            'proxy_read_timeout',
            'proxy_send_timeout',
            'send_timeout',
        ],
    )
    def test_proxy_configures_request_and_response_timeouts(self, timeout_directive):
        assert timeout_directive in self.text

    def test_proxy_normalizes_real_client_ip_before_forwarding_upstream(self):
        assert 'real_ip_header X-Forwarded-For;' in self.text
        assert 'real_ip_recursive on;' in self.text
        assert 'set_real_ip_from 127.0.0.1;' in self.text
        assert 'set_real_ip_from ::1;' in self.text
        assert 'proxy_set_header X-Real-IP $remote_addr;' in self.text
        assert 'proxy_set_header X-Forwarded-For $remote_addr;' in self.text
        assert '$proxy_add_x_forwarded_for' not in self.text


class TestBackendEntrypoint:
    """Verify uvicorn reload is opt-in and proxy headers are enabled."""

    def setup_method(self):
        self.text = (ROOT / 'scripts' / 'docker' / 'docker-entrypoint.sh').read_text()

    def test_hardened_runtime_uses_prebuilt_venv_binaries_without_uv_run(self):
        assert 'uv run ' not in self.text
        assert '.venv/bin/alembic upgrade head' in self.text
        assert '.venv/bin/python scripts/seed_demo_game.py' in self.text
        assert 'exec .venv/bin/uvicorn "$@"' in self.text

    def test_seed_data_uses_tmp_demo_database_on_hardened_runtime(self):
        assert 'sqlite:////tmp/demo.db' in self.text
        assert 'rm -f /tmp/demo.db' in self.text
        assert '/app/demo.db' not in self.text

    def test_uvicorn_reload_is_guarded_by_environment(self):
        assert 'if [ "${UVICORN_RELOAD:-0}" = "1" ]; then' in self.text
        assert 'set -- "$@" --reload' in self.text

    def test_uvicorn_proxy_headers_are_guarded_by_environment(self):
        assert 'if [ "${UVICORN_PROXY_HEADERS:-1}" = "1" ]; then' in self.text
        assert '--proxy-headers' in self.text
        assert '--forwarded-allow-ips' in self.text

    def test_uvicorn_forwarded_allow_ips_default_is_not_wildcard_trust(self):
        assert 'UVICORN_FORWARDED_ALLOW_IPS:-*' not in self.text
        assert 'UVICORN_FORWARDED_ALLOW_IPS:-172.29.0.2' in self.text

    def test_database_migrations_are_opt_in_with_an_explicit_flag(self):
        assert (
            'if [ "$SEED_DATA" = "1" ] || [ "${RUN_DB_MIGRATIONS:-0}" = "1" ]; then'
            in self.text
        )
        assert re.search(
            r'if \[ "\$SEED_DATA" = "1" \] \|\| \[ "\$\{RUN_DB_MIGRATIONS:-0\}" = "1" \]; then\s+echo "Running Alembic migrations\.\.\."\s+\.venv/bin/alembic upgrade head',
            self.text,
        )
        assert 'echo "Skipping Alembic migrations (RUN_DB_MIGRATIONS=0)"' in self.text


class TestComposeHealthAwareness:
    """Verify Compose startup sequencing follows service readiness."""

    def setup_method(self):
        with open(ROOT / 'docker-compose.yml') as f:
            self.compose = yaml.safe_load(f)
        self.services = self.compose['services']

    @pytest.mark.parametrize(
        'service_name',
        ['backend', 'backend-gpu', 'frontend', 'proxy'],
    )
    def test_traffic_facing_services_define_healthchecks(self, service_name):
        healthcheck = self.services[service_name].get('healthcheck')

        assert healthcheck is not None
        assert healthcheck['test']

    def test_proxy_waits_for_healthy_frontend_and_active_backend(self):
        assert self.services['proxy']['depends_on'] == {
            'frontend': {
                'condition': 'service_healthy',
            },
            'backend': {
                'condition': 'service_healthy',
                'required': False,
            },
            'backend-gpu': {
                'condition': 'service_healthy',
                'required': False,
            },
        }


class TestBackendHealthcheckEndpoint:
    """Verify the backend exposes a cheap health endpoint for Compose."""

    def test_healthz_returns_ok(self, client):
        response = client.get('/healthz')

        assert response.status_code == 200
        assert response.json() == {'status': 'ok'}


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


class TestRuntimeDockerfiles:
    """Verify runtime images create and switch to a dedicated non-root user."""

    @pytest.mark.parametrize(
        'dockerfile_path',
        [
            ROOT / 'backend' / 'Dockerfile',
            ROOT / 'backend' / 'Dockerfile.gpu',
            ROOT / 'frontend' / 'Dockerfile',
        ],
    )
    def test_runtime_dockerfiles_define_configurable_non_root_user(
        self, dockerfile_path
    ):
        text = dockerfile_path.read_text()

        assert 'ARG APP_UID=1000' in text
        assert 'ARG APP_GID=1000' in text
        assert 'USER app' in text

    @pytest.mark.parametrize(
        'dockerfile_path',
        [
            ROOT / 'backend' / 'Dockerfile',
            ROOT / 'backend' / 'Dockerfile.gpu',
            ROOT / 'frontend' / 'Dockerfile',
        ],
    )
    def test_runtime_dockerfiles_own_workdirs_for_runtime_user(self, dockerfile_path):
        text = dockerfile_path.read_text()

        assert 'chown -R app:app /app /home/app' in text

    @pytest.mark.parametrize(
        'dockerfile_path',
        [
            ROOT / 'backend' / 'Dockerfile',
            ROOT / 'backend' / 'Dockerfile.gpu',
        ],
    )
    def test_backend_runtime_dockerfiles_precreate_app_data_for_sqlite_volume(
        self, dockerfile_path
    ):
        text = dockerfile_path.read_text()

        assert 'mkdir -p /app/uploads /app/data /home/app' in text


class TestPinnedRuntimeImages:
    """Verify compose and Dockerfiles use immutable, versioned image refs."""

    def setup_method(self):
        self.compose_path = ROOT / 'docker-compose.yml'
        with open(self.compose_path) as f:
            self.compose = yaml.safe_load(f)
        self.deployment_docs = (ROOT / 'docs' / 'deployment.md').read_text()

    def test_compose_image_refs_are_versioned_and_digest_pinned(self):
        for service in self.compose['services'].values():
            image_ref = service.get('image')
            if image_ref is None:
                continue
            _assert_image_ref_is_pinned(image_ref)

    @pytest.mark.parametrize(
        'dockerfile_path',
        [
            ROOT / 'backend' / 'Dockerfile',
            ROOT / 'backend' / 'Dockerfile.gpu',
            ROOT / 'frontend' / 'Dockerfile',
        ],
    )
    def test_runtime_dockerfiles_pin_external_image_inputs(self, dockerfile_path):
        image_refs = _extract_dockerfile_image_refs(dockerfile_path.read_text())

        assert image_refs
        for image_ref in image_refs:
            _assert_image_ref_is_pinned(image_ref)

    def test_deployment_docs_record_the_digest_refresh_review_step(self):
        assert 'manual review' in self.deployment_docs
        assert 'docker buildx imagetools inspect' in self.deployment_docs
