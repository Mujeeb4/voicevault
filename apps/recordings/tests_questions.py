import uuid

from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory

from apps.recordings import views_questions
from apps.recordings.models import RecordingQuestion
from apps.users.models import AuditLog, User
from utils.supabase_auth import SupabaseUser


@override_settings(ADMIN_EMAILS='admin@example.com')
class QuestionAdminRegressionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.admin = User.objects.create(email='admin@example.com', full_name='Admin')
        self.one = RecordingQuestion.objects.create(question_text='One?', domain='childhood', order=101)
        self.two = RecordingQuestion.objects.create(question_text='Two?', domain='childhood', order=102)

    def post(self, path, data):
        request = self.factory.post(path, data, format='json')
        request.supabase_user = SupabaseUser(str(self.admin.id), self.admin.email, {})
        return request

    def test_reorder_rejects_missing_id_without_partial_changes(self):
        missing = uuid.uuid4()
        response = views_questions.reorder_questions(self.post('/reorder/', {
            'questions': [{'id': str(self.one.id), 'order': 102}, {'id': str(missing), 'order': 101}],
        }))
        self.assertEqual(response.status_code, 404)
        self.one.refresh_from_db()
        self.assertEqual(self.one.order, 101)

    def test_reorder_is_atomic_and_audited(self):
        response = views_questions.reorder_questions(self.post('/reorder/', {
            'questions': [{'id': str(self.one.id), 'order': 102}, {'id': str(self.two.id), 'order': 101}],
        }))
        self.assertEqual(response.status_code, 200)
        self.one.refresh_from_db()
        self.two.refresh_from_db()
        self.assertEqual((self.one.order, self.two.order), (102, 101))
        self.assertTrue(AuditLog.objects.filter(action='admin_question_reorder').exists())

    def test_bulk_update_requires_real_boolean_and_known_ids(self):
        response = views_questions.bulk_update_questions(self.post('/bulk-update/', {
            'question_ids': [str(self.one.id)], 'is_active': 'false',
        }))
        self.assertEqual(response.status_code, 400)

        response = views_questions.bulk_update_questions(self.post('/bulk-update/', {
            'question_ids': [str(uuid.uuid4())], 'is_active': False,
        }))
        self.assertEqual(response.status_code, 404)

    def test_create_update_delete_write_audit_log(self):
        create_response = views_questions.create_question(self.post('/create/', {
            'question_text': 'Created question?', 'domain': 'wisdom', 'order': 110,
            'suggested_duration_seconds': 60, 'is_active': True,
        }))
        self.assertEqual(create_response.status_code, 201)
        question_id = create_response.data['id']

        patch_request = self.factory.patch('/update/', {'question_text': 'Updated question?'}, format='json')
        patch_request.supabase_user = SupabaseUser(str(self.admin.id), self.admin.email, {})
        self.assertEqual(views_questions.update_question(patch_request, question_id=question_id).status_code, 200)

        delete_request = self.factory.delete('/delete/')
        delete_request.supabase_user = SupabaseUser(str(self.admin.id), self.admin.email, {})
        self.assertEqual(views_questions.delete_question(delete_request, question_id=question_id).status_code, 200)
        self.assertEqual(
            AuditLog.objects.filter(action__in=['admin_question_create', 'admin_question_update', 'admin_question_delete']).count(),
            3,
        )
