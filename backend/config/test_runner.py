"""Tests must mock provider HTTP calls rather than reaching external services."""
from contextlib import ExitStack
from unittest.mock import patch

from django.test.runner import DiscoverRunner


class OfflineTestRunner(DiscoverRunner):
    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        self.network_guards = ExitStack()
        for target in ('socket.socket.connect', 'socket.socket.connect_ex', 'socket.create_connection'):
            self.network_guards.enter_context(patch(
                target, side_effect=AssertionError('Network disabled in tests; mock the provider'),
            ))

    def teardown_test_environment(self, **kwargs):
        try:
            self.network_guards.close()
        finally:
            super().teardown_test_environment(**kwargs)
