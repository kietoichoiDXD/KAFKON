"""Test chat persistence and project isolation."""
import unittest
from backend import api


class TestProjectChatPersistence(unittest.TestCase):
    def setUp(self):
        api.app.config["TESTING"] = True
        self.client = api.app.test_client()

    def test_session_lifecycle_and_turn_persistence(self):
        # 1. Create a session for project-a
        res = self.client.post("/api/projects/proj-test-a/new-session", json={"title": "Session A"})
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        session_a_id = data["id"]
        self.assertEqual(data["project_id"], "proj-test-a")

        # 2. Add a chat turn
        chat_res = self.client.post("/api/chat", json={
            "messages": ["Hello project A!"],
            "session_id": session_a_id,
            "project_id": "proj-test-a",
            "skill": "startup_lean",
            "tier": "low"
        })
        self.assertEqual(chat_res.status_code, 200)

        # 3. Retrieve session and verify turns are saved
        get_res = self.client.get(f"/api/chat/sessions/{session_a_id}")
        self.assertEqual(get_res.status_code, 200)
        session_data = get_res.get_json()
        self.assertGreaterEqual(len(session_data["turns"]), 2)
        self.assertEqual(session_data["turns"][0]["text"], "Hello project A!")

        # 4. Verify list sessions filters by project
        list_a = self.client.get("/api/chat/sessions?project_id=proj-test-a").get_json()
        self.assertTrue(any(s["id"] == session_a_id for s in list_a))

        list_b = self.client.get("/api/chat/sessions?project_id=proj-test-b").get_json()
        self.assertFalse(any(s["id"] == session_a_id for s in list_b))

    def test_reuse_empty_session_prevents_duplication(self):
        # Creating multiple new sessions for proj-empty without turns should reuse the empty session
        res1 = self.client.post("/api/projects/proj-empty/new-session", json={}).get_json()
        res2 = self.client.post("/api/projects/proj-empty/new-session", json={}).get_json()
        self.assertEqual(res1["id"], res2["id"])
