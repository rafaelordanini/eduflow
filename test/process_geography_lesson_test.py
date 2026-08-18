import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).parents[1] / "scripts" / "process_geography_lesson.py"
SPEC = importlib.util.spec_from_file_location("process_geography_lesson", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class GeographyProcessorTests(unittest.TestCase):
    def test_chunks_preserve_every_line_and_limit_normal_chunks(self):
        source = "\n".join(f"linha {index} com conteúdo" for index in range(30))
        parts = MODULE.chunks(source, max_chars=100)
        self.assertEqual("\n".join(parts), source)
        self.assertTrue(all(len(part) <= 100 for part in parts))

    def test_parse_model_json_accepts_plain_and_fenced_json(self):
        expected = {"summary": "conteúdo"}
        self.assertEqual(MODULE.parse_model_json(json.dumps(expected)), expected)
        self.assertEqual(MODULE.parse_model_json(f"```json\n{json.dumps(expected)}\n```"), expected)

    def test_constants_restrict_the_pilot(self):
        self.assertEqual(MODULE.PILOT_SUBJECT, "Geografia")
        self.assertEqual(MODULE.PILOT_ORDER, 1)
        self.assertEqual(MODULE.DEFAULT_DRIVE_ID, "16ikDG560clJixXEeKl-615otamtefwkI")

    def test_media_validation_rejects_html_and_accepts_ffprobe_media(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "download"
            path.write_bytes(b"<html>login</html>" * 100)
            self.assertFalse(MODULE.is_media_file(path))
            path.write_bytes(b"0" * (1024 * 1024 + 1))
            probe = mock.Mock(returncode=0, stdout='{"format":{"format_name":"mov,mp4","duration":"60"}}')
            with mock.patch.object(MODULE.subprocess, "run", return_value=probe):
                self.assertTrue(MODULE.is_media_file(path))

    def test_download_includes_google_drive_preview_stream_fallback(self):
        source = pathlib.Path(MODULE.__file__).read_text(encoding="utf-8")
        self.assertIn('"-m", "yt_dlp"', source)
        self.assertIn('"--fragment-retries", "10"', source)


if __name__ == "__main__":
    unittest.main()
