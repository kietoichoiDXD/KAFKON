"""The router that decides between answering and specifying.

Before this existed, asking ScribeBA a question produced "routine chatter without architectural
decisions" — a correct verdict from the analyser and a broken assistant.
"""
import unittest

from backend.chat import looks_like_a_discussion, wants_an_infra_check


class TestChatRouting(unittest.TestCase):
    def test_a_question_is_not_a_discussion(self):
        for q in [
            "What can you do?",
            "Bạn làm được gì?",
            "how is this different from a chatbot",
            "what does Blocked mean",
        ]:
            self.assertFalse(looks_like_a_discussion([q]), q)

    def test_a_pasted_thread_is_a_discussion(self):
        thread = [
            "@alex: We must implement Google SSO restricted to acmecorp.com.",
            "@oliver: All accounts land in the Engineer read-only role.",
            "@alex: Session timeout 8h or 24h?",
        ]
        self.assertTrue(looks_like_a_discussion(thread))

    def test_two_named_speakers_are_enough(self):
        self.assertTrue(looks_like_a_discussion([
            "@alex: we need SSO",
            "@oliver: restrict it to the corporate domain",
        ]))

    def test_one_long_requirement_paragraph_is_a_discussion(self):
        self.assertTrue(looks_like_a_discussion([
            "We must implement Google OAuth 2.0 single sign-on restricted to the acmecorp.com "
            "domain, and every provisioned account should land in the Engineer read-only role "
            "until an administrator elevates it."
        ]))

    def test_a_short_greeting_is_not(self):
        self.assertFalse(looks_like_a_discussion(["hi"]))
        self.assertFalse(looks_like_a_discussion(["thanks, that helps"]))


class TestInfraIntent(unittest.TestCase):
    """Asking about the cluster must make it look, not describe itself.

    The bug this covers: asked to "check my infra, there is some error happened", ScribeBA replied
    that it had no cluster access - while the incident console was reading that cluster fine.
    """

    def test_asking_about_infra_triggers_a_real_check(self):
        for q in [
            "check my infra ,there is some errror happtened",
            "hạ tầng đang lỗi, kiểm tra giúp tôi",
            "what's wrong with the cluster?",
            "can you look at the error rate",
            "debug this incident for me",
        ]:
            self.assertTrue(wants_an_infra_check([q]), q)

    def test_ordinary_questions_do_not(self):
        for q in [
            "what can you do?",
            "hi",
            "draft a ticket from this thread",
            "what does Blocked mean",
        ]:
            self.assertFalse(wants_an_infra_check([q]), q)

    def test_only_the_latest_message_decides(self):
        # An earlier infra question should not make every later message a cluster read.
        self.assertFalse(wants_an_infra_check([
            "check the cluster please", "now draft the ticket"
        ]))


if __name__ == "__main__":
    unittest.main()
