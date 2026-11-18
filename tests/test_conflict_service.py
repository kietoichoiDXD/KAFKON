import tempfile
import unittest
from pathlib import Path

from backend.core.conflict_service import scan_task_against_repository


class TestTaskRepositoryConflictGraph(unittest.TestCase):
    def test_only_explicit_configuration_mismatch_is_a_conflict(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "src" / "auth.py"
            source.parent.mkdir(parents=True)
            source.write_text("SESSION_TIMEOUT_SECONDS = 24 * 60 * 60\n", encoding="utf-8")

            result = scan_task_against_repository(
                {
                    "name": "Session timeout policy",
                    "description": "Idle session timeout must be 8 hours for authenticated users.",
                },
                root,
            )

        conflicts = [edge for edge in result["edges"] if edge["relation"] == "conflict"]
        self.assertEqual(len(conflicts), 1)
        self.assertIn("28800s", conflicts[0]["reason"])
        self.assertIn("86400s", conflicts[0]["reason"])
        code_node = next(node for node in result["nodes"] if node.get("path") == "src/auth.py")
        self.assertEqual(code_node["line"], 1)
        self.assertEqual(result["summary"]["conflicts"], 1)

    def test_evidence_appendix_and_generated_sources_are_not_requirements(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "src").mkdir()
            (root / "src" / "auth.py").write_text(
                "def authenticate_google_workspace(user): return user\n", encoding="utf-8"
            )
            (root / "tests").mkdir()
            (root / "tests" / "test_auth.py").write_text(
                "SESSION_TIMEOUT_SECONDS = 24 * 60 * 60\n", encoding="utf-8"
            )
            (root / ".rooms.json").write_text(
                '{"session": "test data"}', encoding="utf-8"
            )

            result = scan_task_against_repository(
                {
                    "name": "Google Workspace authentication",
                    "description": (
                        "Users can authenticate with Google Workspace accounts.\n"
                        "## Evidence Breakdown\n"
                        "- An old test says the session timeout is 24 hours.\n"
                        "### ScribeBA Audit & Provenance Ledger\n"
                        "- Source Thread: example"
                    ),
                },
                root,
            )

        requirement_nodes = [node for node in result["nodes"] if node["type"] == "requirement"]
        code_nodes = [node for node in result["nodes"] if node["type"] == "code"]
        self.assertEqual(len(requirement_nodes), 1)
        self.assertIn("Google Workspace", requirement_nodes[0]["label"])
        self.assertEqual([node["path"] for node in code_nodes if node.get("path")], ["src/auth.py"])
        self.assertEqual(result["summary"]["conflicts"], 0)
        self.assertTrue(all(edge["relation"] != "conflict" for edge in result["edges"]))


if __name__ == "__main__":
    unittest.main()
