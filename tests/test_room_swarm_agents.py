import unittest
from unittest.mock import patch, AsyncMock
from tempfile import TemporaryDirectory
from pathlib import Path
from backend.api import app, _load_rooms, _save_rooms, DEFAULT_ROOMS_DATA, DEFAULT_SQUAD_AGENTS

class TestRoomSwarmAgents(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_rooms_have_default_squad_agents(self):
        rooms = _load_rooms()
        self.assertGreaterEqual(len(rooms), 1)
        for r in rooms:
            self.assertIn("squad_agents", r)
            self.assertGreaterEqual(len(r["squad_agents"]), 4)
            agent_ids = [a["agent_id"] for a in r["squad_agents"]]
            self.assertIn("lead-agile-pm", agent_ids)
            self.assertIn("tech-lead-arch", agent_ids)
            self.assertIn("qa-secops", agent_ids)
            self.assertIn("task-decomposer", agent_ids)

    def test_swarm_debate_creates_turns_and_pending_tasks(self):
        with patch("backend.api._load_rooms") as mock_load, patch("backend.api._save_rooms") as mock_save:
            room = {
                "id": "test-room",
                "name": "Auth & IAM Federation",
                "topic": "Google Workspace SSO with domain restriction",
                "chat_messages": [],
                "tasks": [],
                "squad_agents": list(DEFAULT_SQUAD_AGENTS),
            }
            mock_load.return_value = [room]

            resp = self.client.post("/api/rooms/test-room/swarm-debate", json={
                "topic": "Google Workspace SSO with domain restriction"
            })
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertEqual(data["status"], "ok")
            self.assertGreaterEqual(len(data["debate_turns"]), 4)
            self.assertGreaterEqual(len(data["created_tasks"]), 3)

            # Check tasks in room have dispatch_status == 'pending_review'
            for task in data["created_tasks"]:
                self.assertEqual(task["dispatch_status"], "pending_review")
                self.assertIn("target_files", task)
                self.assertIn("execution_steps", task)
                self.assertGreater(len(task["execution_steps"]), 0)

            # Check debate turns added to chat messages
            self.assertGreaterEqual(len(room["chat_messages"]), 4)

    def test_dispatch_task_approve_and_reject(self):
        with patch("backend.api._load_rooms") as mock_load, patch("backend.api._save_rooms") as mock_save:
            task = {
                "id": "t-1",
                "title": "Config SSO",
                "status": "Backlog",
                "dispatch_status": "pending_review",
                "assigned_to": "⚡ Dev Task Decomposer",
                "target_files": ["backend/api.py"],
                "execution_steps": ["Step 1"],
            }
            room = {
                "id": "test-room",
                "name": "Test Room",
                "tasks": [task],
                "chat_messages": [],
            }
            mock_load.return_value = [room]

            # Approve
            resp = self.client.post("/api/rooms/test-room/dispatch-task", json={
                "task_id": "t-1",
                "action": "approve"
            })
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(task["dispatch_status"], "approved")
            self.assertEqual(task["status"], "In Progress")

            # Reject
            resp2 = self.client.post("/api/rooms/test-room/dispatch-task", json={
                "task_id": "t-1",
                "action": "reject",
                "notes": "Scope too broad"
            })
            self.assertEqual(resp2.status_code, 200)
            self.assertEqual(task["dispatch_status"], "rejected")
            self.assertEqual(task["status"], "Blocked")

    def test_dispatch_task_clickup(self):
        with patch("backend.api._load_rooms") as mock_load, patch("backend.api._save_rooms") as mock_save:
            task = {
                "id": "t-1",
                "title": "Deploy SSO",
                "status": "Backlog",
                "priority": "High",
                "dispatch_status": "pending_review",
                "assigned_to": "⚡ Dev Task Decomposer",
                "target_files": ["backend/api.py"],
                "execution_steps": ["Step 1"],
            }
            room = {
                "id": "test-room",
                "name": "Test Room",
                "tasks": [task],
                "chat_messages": [],
            }
            mock_load.return_value = [room]

            with patch("backend.integrations.clickup_client.ClickUpClient.create_simple_task", new_callable=AsyncMock) as mock_cu:
                mock_cu.return_value = {
                    "id": "cu-12345",
                    "name": "Deploy SSO",
                    "url": "https://app.clickup.com/t/cu-12345",
                    "status": "to do"
                }
                resp = self.client.post("/api/rooms/test-room/dispatch-task", json={
                    "task_id": "t-1",
                    "action": "dispatch_clickup"
                })
                self.assertEqual(resp.status_code, 200)
                self.assertEqual(task["dispatch_status"], "dispatched")
                self.assertEqual(task["clickup_url"], "https://app.clickup.com/t/cu-12345")

    def test_add_and_delete_room_agent(self):
        with patch("backend.api._load_rooms") as mock_load, patch("backend.api._save_rooms") as mock_save:
            room = {
                "id": "test-room",
                "name": "Test Room",
                "tasks": [],
                "chat_messages": [],
                "squad_agents": [],
            }
            mock_load.return_value = [room]

            # Add repo-grounded agent
            resp = self.client.post("/api/rooms/test-room/agents", json={
                "agent_id": "fastapi-dev",
                "agent_name": "FastAPI Core Dev",
                "avatar": "🚀",
                "role": "Backend Core Engineer",
                "repo_binding": "backend/api.py",
                "model_tier": "Nebius Qwen-30B (Fast)",
                "autonomy_mode": "Autonomous",
                "instructions": "Develop endpoints cleanly."
            })
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(len(room["squad_agents"]), 1)
            self.assertEqual(room["squad_agents"][0]["agent_id"], "fastapi-dev")
            self.assertEqual(room["squad_agents"][0]["repo_binding"], "backend/api.py")

            # Delete agent
            del_resp = self.client.delete("/api/rooms/test-room/agents/fastapi-dev")
            self.assertEqual(del_resp.status_code, 200)
            self.assertEqual(len(room["squad_agents"]), 0)


if __name__ == "__main__":
    unittest.main()
