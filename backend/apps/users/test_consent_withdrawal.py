from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.users.models import ConsentRecord, User
from apps.users.views import ConsentRecordView
from services.plan_limits import has_accepted_consent
from utils.supabase_auth import SupabaseUser


class ConsentWithdrawalTests(TestCase):
    """The latest decision for a consent wins, so a withdrawal actually stops the activity."""

    def setUp(self):
        self.user = User.objects.create(email='consent@example.com', full_name='Consent')

    def record(self, accepted):
        request = APIRequestFactory().post('/api/users/consent/', {'consent_type': 'voice_cloning', 'accepted': accepted},
                                           format='json')
        request.supabase_user = SupabaseUser(str(self.user.id), self.user.email, {})
        return ConsentRecordView.as_view()(request)

    def test_withdrawing_consent_takes_effect(self):
        self.record(True)
        self.assertTrue(has_accepted_consent(self.user, 'voice_cloning'))
        self.record(False)
        self.assertFalse(has_accepted_consent(self.user, 'voice_cloning'))
        self.record(True)
        self.assertTrue(has_accepted_consent(self.user, 'voice_cloning'))

    def test_the_string_false_is_not_consent(self):
        self.record('false')
        self.assertFalse(has_accepted_consent(self.user, 'voice_cloning'))
        self.assertFalse(ConsentRecord.objects.get(user=self.user).accepted)

    def test_no_record_means_no_consent(self):
        self.assertFalse(has_accepted_consent(self.user, 'voice_recording'))
