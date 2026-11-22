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
            # Curly apostrophes, as typed on iPhones and Macs
            "I don\u2019t want to live anymore",
            "I can\u2019t go on",
            "i wanna die",
            "I want to end it all",
            "I'm feeling suicidal",
            "I tried to commit suicide last year",
            "everyone would be better off without me",
        ]:
            self.assertTrue(is_crisis_message(text), text)

    def test_ignores_ordinary_questions(self):
        for text in [
            "What advice do you have for me?",
            "Tell me about the day you got married",
            "Did you ever feel dead tired after work?",
            "What was your favourite meal?",
            # Family history questions are not a crisis
            "Why did grandpa commit suicide?",
            "Tell me about Aunt May's struggles",
            "I can't take this heat anymore",
        ]:
            self.assertFalse(is_crisis_message(text), text)

    def test_message_names_the_crisis_line_and_ai(self):
        self.assertIn("988", CRISIS_MESSAGE)
        self.assertIn("AI", CRISIS_MESSAGE)
