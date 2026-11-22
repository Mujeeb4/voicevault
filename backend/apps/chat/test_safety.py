from django.test import SimpleTestCase

from apps.chat.safety import CRISIS_MESSAGE, is_crisis_message


class CrisisDetectionTests(SimpleTestCase):
    def test_flags_self_harm_language(self):
        for text in [
            "I want to kill myself",
            "sometimes I think about suicide",
            "I don't want to live anymore",
            "I wish I was dead",
            "I've been hurting myself",
        ]:
            self.assertTrue(is_crisis_message(text), text)

    def test_ignores_ordinary_questions(self):
        for text in [
            "What advice do you have for me?",
            "Tell me about the day you got married",
            "Did you ever feel dead tired after work?",
            "What was your favourite meal?",
        ]:
            self.assertFalse(is_crisis_message(text), text)

    def test_message_names_the_crisis_line_and_ai(self):
        self.assertIn("988", CRISIS_MESSAGE)
        self.assertIn("AI", CRISIS_MESSAGE)
