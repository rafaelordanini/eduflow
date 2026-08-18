import importlib.util
import json
import pathlib
import unittest


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


if __name__ == "__main__":
    unittest.main()
