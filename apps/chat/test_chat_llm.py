from django.test import SimpleTestCase, override_settings
from types import SimpleNamespace

from services.chat_llm import get_chat_backend, streamed_total_tokens


class ChatBackendTests(SimpleTestCase):
    @override_settings(
        CHAT_PROVIDER='qwen', QWEN_API_KEY='qwen-test-key',
        QWEN_CHAT_MODEL='qwen3.8-flash',
        QWEN_CHAT_BASE_URL='https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
    )
    def test_qwen_uses_token_plan_endpoint_without_thinking(self):
        backend = get_chat_backend()
        self.assertEqual(backend.provider, 'qwen')
        self.assertEqual(backend.model, 'qwen3.8-flash')
        self.assertIn('token-plan.maas.qwencloudapi.com', backend.base_url)
        self.assertEqual(backend.extra_body, {'enable_thinking': False})

    @override_settings(CHAT_PROVIDER='openai', OPENAI_API_KEY='openai-test-key', OPENAI_CHAT_MODEL='gpt-4o')
    def test_openai_remains_available(self):
        backend = get_chat_backend()
        self.assertEqual(backend.model, 'gpt-4o')
        self.assertIsNone(backend.base_url)
        self.assertEqual(backend.extra_body, {})

    @override_settings(CHAT_PROVIDER='qwen', QWEN_API_KEY='')
    def test_missing_key_fails_before_request(self):
        with self.assertRaisesRegex(ValueError, 'API key is not configured'):
            get_chat_backend()

    def test_streamed_usage_accepts_qwen_dictionary_and_openai_object(self):
        self.assertEqual(streamed_total_tokens(SimpleNamespace(usage={'total_tokens': 42})), 42)
        self.assertEqual(streamed_total_tokens(SimpleNamespace(usage=SimpleNamespace(total_tokens=43))), 43)
        self.assertIsNone(streamed_total_tokens(SimpleNamespace(usage=None)))
        self.assertIsNone(streamed_total_tokens(SimpleNamespace(usage={'total_tokens': 'unknown'})))
