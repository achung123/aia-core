"""Tests for T-004: Create YOLO training script."""

import ast
import argparse
import os
import sys
from unittest.mock import MagicMock, patch

import pytest


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(PROJECT_ROOT, 'scripts')


class TestTrainScriptExists:
    """AC-1: scripts/train_model.py exists and is runnable."""

    def test_script_exists(self):
        script = os.path.join(SCRIPTS_DIR, 'train_model.py')
        assert os.path.isfile(script), 'scripts/train_model.py must exist'

    def test_script_is_valid_python(self):
        script = os.path.join(SCRIPTS_DIR, 'train_model.py')
        with open(script) as f:
            source = f.read()
        ast.parse(source)

    def test_script_has_main_guard(self):
        script = os.path.join(SCRIPTS_DIR, 'train_model.py')
        with open(script) as f:
            source = f.read()
        assert 'if __name__' in source, (
            "Script must have if __name__ == '__main__' guard"
        )


class TestTrainScriptCLIArgs:
    """AC-2: Accepts CLI args with correct defaults."""

    @pytest.fixture
    def parse_args(self):
        """Import the parse_args function from the training script."""
        sys.path.insert(0, SCRIPTS_DIR)
        try:
            import train_model
            return train_model.parse_args
        finally:
            sys.path.pop(0)
            sys.modules.pop('train_model', None)

    def test_default_epochs(self, parse_args):
        args = parse_args([])
        assert args.epochs == 50

    def test_default_batch(self, parse_args):
        args = parse_args([])
        assert args.batch == 16

    def test_default_imgsz(self, parse_args):
        args = parse_args([])
        assert args.imgsz == 640

    def test_default_model(self, parse_args):
        args = parse_args([])
        assert args.model == 'yolov8n.pt'

    def test_default_data(self, parse_args):
        args = parse_args([])
        assert args.data == 'data/cards/data.yaml'

    def test_custom_epochs(self, parse_args):
        args = parse_args(['--epochs', '100'])
        assert args.epochs == 100

    def test_custom_batch(self, parse_args):
        args = parse_args(['--batch', '32'])
        assert args.batch == 32

    def test_custom_imgsz(self, parse_args):
        args = parse_args(['--imgsz', '1280'])
        assert args.imgsz == 1280

    def test_custom_model(self, parse_args):
        args = parse_args(['--model', 'yolov8s.pt'])
        assert args.model == 'yolov8s.pt'

    def test_custom_data(self, parse_args):
        args = parse_args(['--data', 'other/data.yaml'])
        assert args.data == 'other/data.yaml'


class TestTrainScriptImports:
    """AC-3: Script uses ultralytics YOLO."""

    def test_script_references_ultralytics(self):
        script = os.path.join(SCRIPTS_DIR, 'train_model.py')
        with open(script) as f:
            source = f.read()
        assert 'ultralytics' in source, 'Script must import from ultralytics'

    def test_script_references_yolo(self):
        script = os.path.join(SCRIPTS_DIR, 'train_model.py')
        with open(script) as f:
            source = f.read()
        assert 'YOLO' in source, 'Script must use YOLO class'


class TestTrainScriptSmokeTest:
    """AC-3 & AC-4: Script calls train and val, prints metrics."""

    @pytest.fixture(autouse=True)
    def _import_train_module(self):
        """Import train_model into sys.modules so we can patch it."""
        sys.path.insert(0, SCRIPTS_DIR)
        import train_model

        self.train_model = train_model
        yield
        sys.path.remove(SCRIPTS_DIR)
        sys.modules.pop('train_model', None)

    def _make_args(self, **overrides):
        defaults = dict(
            epochs=1, batch=2, imgsz=320,
            model='yolov8n.pt', data='data/cards/data.yaml',
        )
        defaults.update(overrides)
        return argparse.Namespace(**defaults)

    def _mock_yolo(self):
        mock_model = MagicMock()
        mock_results = MagicMock()
        mock_results.results_dict = {
            'metrics/mAP50(B)': 0.85,
            'metrics/mAP50-95(B)': 0.60,
        }
        mock_model.val.return_value = mock_results
        return mock_model

    def test_train_calls_yolo_train(self):
        mock_model = self._mock_yolo()
        with patch.object(self.train_model, 'YOLO', return_value=mock_model) as mock_cls:
            self.train_model.train(self._make_args())

            mock_cls.assert_called_once_with('yolov8n.pt')
            mock_model.train.assert_called_once_with(
                data='data/cards/data.yaml',
                epochs=1,
                batch=2,
                imgsz=320,
                project='runs/card_detector',
            )
            mock_model.val.assert_called_once()

    def test_train_prints_map_metrics(self, capsys):
        mock_model = self._mock_yolo()
        with patch.object(self.train_model, 'YOLO', return_value=mock_model):
            self.train_model.train(self._make_args())

        captured = capsys.readouterr()
        assert 'mAP@50' in captured.out
        assert '0.85' in captured.out
        assert 'mAP@50-95' in captured.out
        assert '0.60' in captured.out


class TestGitignoreRunsDir:
    """AC-5: runs/ added to .gitignore."""

    def test_gitignore_contains_runs(self):
        gitignore_path = os.path.join(PROJECT_ROOT, '.gitignore')
        assert os.path.exists(gitignore_path), '.gitignore must exist'
        with open(gitignore_path) as f:
            lines = [line.strip() for line in f.readlines()]
        assert any(line in ('runs/', 'runs') for line in lines), (
            ".gitignore must contain 'runs/' entry"
        )
