"""Destroy voice recordings and voice models of accounts inactive for 3 years.

Our Privacy Policy promises this. Run it on a schedule (for example monthly):
    python manage.py purge_inactive_voice_data            # do it
    python manage.py purge_inactive_voice_data --dry-run  # only report
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.ai_processing.models import AIConfiguration
from apps.recordings.models import AudioRecording
from apps.users.models import User
from services.voice_cloning import delete_voice_clone
from utils.supabase_client import delete_file_from_supabase

RETENTION_DAYS = 365 * 3


class Command(BaseCommand):
    help = 'Delete voice recordings and voice models for accounts with no sign-in for 3 years'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(days=RETENTION_DAYS)
        stale = User.objects.filter(
            Q(last_login_at__lt=cutoff) | Q(last_login_at__isnull=True, created_at__lt=cutoff)
        )
        purged = 0
        for user in stale:
            recordings = list(AudioRecording.objects.filter(user=user))
            config = AIConfiguration.objects.filter(user=user).first()
            if not recordings and not (config and (config.voice_clone_id or config.voice_reference_path)):
                continue
            purged += 1
            if options['dry_run']:
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
                config.voice_clone_id = ''
                config.voice_reference_path = ''
                config.save(update_fields=['voice_clone_id', 'voice_reference_path'])
            user.recording_completed = False
            user.save(update_fields=['recording_completed'])
        self.stdout.write(f'{"Would purge" if options["dry_run"] else "Purged"} voice data for {purged} inactive account(s).')
