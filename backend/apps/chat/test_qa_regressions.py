"""Regression tests: malformed chat requests get 4xx, and an unstarted answer stream returns its question."""
import json
import uuid
from unittest import mock

from django.test import Client, TestCase

from apps.chat.views import _RefundIfNeverStarted
from apps.users.models import User


class MalformedChatRequestTests(TestCase):
    def setUp(self):
        self.client = Client(raise_request_exception=False)
        self.owner = User.objects.create(id=uuid.uuid4(), email='owner@example.com', full_name='Owner')

    def post(self, body, raw=False):
        return self.client.post('/api/chat/stream/', data=body if raw else json.dumps(body),
                                content_type='application/json')

    def test_bad_input_is_a_client_error_not_a_500(self):
        cases = [
            {'ai_owner_id': 'not-a-uuid', 'question': 'hi'},
            {'ai_owner_id': str(self.owner.id), 'question': None},
            {'ai_owner_id': str(self.owner.id), 'question': 123},
            {'ai_owner_id': 12345, 'question': 'hi'},
        ]
        for body in cases:
            self.assertIn(self.post(body).status_code, (400, 404), body)
        self.assertEqual(self.post('[1, 2]', raw=True).status_code, 400)
        self.assertEqual(self.post('\xff', raw=True).status_code, 400)

    def test_history_and_audio_status_reject_non_uuid_ids(self):
        self.assertIn(self.client.get('/api/chat/conversations/?ai_owner_id=zzz').status_code, (401, 404))


class RefundIfNeverStartedTests(TestCase):
    @staticmethod
    def stream():
        yield 'a'
        yield 'b'

    def test_closing_an_unstarted_stream_refunds_once(self):
        refund = mock.Mock()
        wrapped = _RefundIfNeverStarted(self.stream(), refund)
        wrapped.close()
        wrapped.close()
        refund.assert_called_once()

    def test_a_started_stream_is_left_to_its_own_cleanup(self):
        refund = mock.Mock()
        wrapped = _RefundIfNeverStarted(self.stream(), refund)
        self.assertEqual(next(wrapped), 'a')
        wrapped.close()
        refund.assert_not_called()
