"""Destroy voice recordings and voice models of vaults nobody has used for at least 5 years.

Our Privacy Policy promises this. A vault counts as in use while the owner signs in OR anyone
talks to it: the product's main purpose is family members chatting after the owner has died,
so a vault the family still uses is never purged, however long ago the owner last signed in.

Not scheduled automatically. Run by hand, and always look at the dry run first:
    python manage.py purge_inactive_voice_data --dry-run  # only report
    python manage.py purge_inactive_voice_data            # do it
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db.models import Max
from django.utils import timezone

from apps.ai_processing.models import AIConfiguration
from apps.chat.models import Conversation
from apps.recordings.models import AudioRecording
from apps.users.models import FamilyMember, User
from services.voice_cloning import delete_voice_clone
from utils.supabase_client import delete_file_from_supabase

# Never less than 5 years, whatever the setting says
MINIMUM_INACTIVE_YEARS = 5


def inactive_years() -> int:
    return max(getattr(settings, 'VOICE_DATA_INACTIVE_YEARS', MINIMUM_INACTIVE_YEARS), MINIMUM_INACTIVE_YEARS)


def last_vault_activity(user: User):
    """The latest of: the owner signing in, any conversation with their AI, a family member chatting."""
    moments = [
        user.last_login_at,
        user.created_at,
        Conversation.objects.filter(ai_owner=user).aggregate(latest=Max('created_at'))['latest'],
        FamilyMember.objects.filter(ai_owner=user).aggregate(latest=Max('last_conversation_at'))['latest'],
    ]
    return max(moment for moment in moments if moment is not None)


class Command(BaseCommand):
    help = 'Delete voice recordings and voice models for vaults with no sign-in or conversation for 5+ years'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        years = inactive_years()
        cutoff = timezone.now() - timedelta(days=365 * years)
        purged = 0
        # Cheap first filter on sign-in and account age; vault activity is checked per account
        for user in User.objects.filter(created_at__lt=cutoff).exclude(last_login_at__gte=cutoff):
            if last_vault_activity(user) >= cutoff:
                continue
            recordings = list(AudioRecording.objects.filter(user=user))
            config = AIConfiguration.objects.filter(user=user).first()
            if not recordings and not (config and (config.voice_clone_id or config.voice_reference_path)):
                continue
            purged += 1
            if options['dry_run']:
                self.stdout.write(f'Would purge voice data for user {user.id} (last activity {last_vault_activity(user):%Y-%m-%d})')
                continue
            for rec in recordings:
                if rec.storage_path:
                    try:
                        delete_file_from_supabase(bucket='recordings', file_path=rec.storage_path)
                    except Exception:  # noqa: BLE001 - best effort, the row is removed regardless
                        pass
            AudioRecording.objects.filter(user=user).delete()
            if config:
                delete_voice_clone(config.voice_clone_id)
                if config.voice_reference_path:
                    try:
                        delete_file_from_supabase(bucket='recordings', file_path=config.voice_reference_path)
                    except Exception:  # noqa: BLE001
                        pass
                # Clearing these also makes has_cloned_voice false, so chat stops offering voice
                config.voice_clone_id = ''
                config.voice_reference_path = ''
                config.save(update_fields=['voice_clone_id', 'voice_reference_path'])
            user.recording_completed = False
            user.save(update_fields=['recording_completed'])
        verb = 'Would purge' if options['dry_run'] else 'Purged'
        self.stdout.write(f'{verb} voice data for {purged} vault(s) inactive for {years}+ years.')
