"""
Plan limits and quota enforcement for VoiceVault freemium.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.db.models import Sum
from django.utils import timezone

from apps.users.models import AuditLog, ConsentRecord, FamilyMember, UsageQuota, User
from utils.security import validate_audio_magic


FREE_LIMITS = {
    "recording_questions": 5,
    "recording_minutes": 15,
    "text_messages_monthly": 5,
    "voice_responses_monthly": 0,
    "family_members": 1,
    "storage_mb": 500,
    "ai_generations": 1,
}

PREMIUM_LIMITS = {
    "recording_questions": 30,
    "recording_minutes": 300,
    "text_messages_monthly": 1000,
    "voice_responses_monthly": 200,
    "family_members": 10,
    "storage_mb": 5000,
    "ai_generations": 3,
}

SUPPORTED_AUDIO_EXTENSIONS = {"webm", "mp3", "wav"}
SUPPORTED_AUDIO_TYPES = {
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
}


@dataclass
class LimitResult:
    allowed: bool
    message: str = ""
    upgrade_required: bool = False
    limit_key: str | None = None
    limit: int | float | None = None
    used: int | float | None = None

    def as_error(self) -> dict:
        return {
            "error": self.message,
            "upgrade_required": self.upgrade_required,
            "limit_key": self.limit_key,
            "limit": self.limit,
            "used": self.used,
            "upgrade_url": "/pricing" if self.upgrade_required else None,
        }


def is_premium(user: User) -> bool:
    return bool(getattr(user, "has_premium_access", False))


def get_limits(user: User) -> dict:
    return PREMIUM_LIMITS if is_premium(user) else FREE_LIMITS


def next_month_start(from_date: date | None = None) -> date:
    current = from_date or timezone.localdate()
    if current.month == 12:
        return date(current.year + 1, 1, 1)
    return date(current.year, current.month + 1, 1)


def get_or_create_quota(user: User) -> UsageQuota:
    quota, _ = UsageQuota.objects.get_or_create(
        user=user,
        defaults={"quota_reset_date": next_month_start()},
    )
    if quota.quota_reset_date and quota.quota_reset_date <= timezone.localdate():
        quota.text_messages_used_this_month = 0
        quota.voice_responses_used_this_month = 0
        quota.quota_reset_date = next_month_start()
        quota.save(update_fields=[
            "text_messages_used_this_month",
            "voice_responses_used_this_month",
            "quota_reset_date",
            "updated_at",
        ])
    elif not quota.quota_reset_date:
        quota.quota_reset_date = next_month_start()
        quota.save(update_fields=["quota_reset_date", "updated_at"])
    return quota


def sync_recording_usage(user: User) -> UsageQuota:
    from apps.recordings.models import AudioRecording

    quota = get_or_create_quota(user)
    totals = AudioRecording.objects.filter(user=user, upload_status="complete").aggregate(
        total_seconds=Sum("duration_seconds"),
        total_bytes=Sum("file_size_bytes"),
    )
    quota.recording_minutes_used = round((totals["total_seconds"] or 0) / 60, 2)
    quota.recording_storage_used_mb = round((totals["total_bytes"] or 0) / (1024 * 1024), 2)
    quota.save(update_fields=[
        "recording_minutes_used",
        "recording_storage_used_mb",
        "updated_at",
    ])
    return quota


def quota_status(user: User) -> dict:
    quota = sync_recording_usage(user)
    limits = get_limits(user)
    return {
        "plan_type": "premium" if is_premium(user) else "free",
        "is_premium": is_premium(user),
        "limits": limits,
        "usage": {
            "recording_minutes_used": quota.recording_minutes_used,
            "recording_storage_used_mb": quota.recording_storage_used_mb,
            "text_messages_used_this_month": quota.text_messages_used_this_month,
            "voice_responses_used_this_month": quota.voice_responses_used_this_month,
            "family_invites_used": FamilyMember.objects.filter(ai_owner=user).count(),
            "ai_generations_used": quota.ai_generations_used,
            "quota_reset_date": quota.quota_reset_date.isoformat() if quota.quota_reset_date else None,
        },
    }


def validate_audio_file(audio_file) -> LimitResult:
    file_name = getattr(audio_file, "name", "") or ""
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if extension not in SUPPORTED_AUDIO_EXTENSIONS:
        return LimitResult(False, "Invalid file format. Allowed: webm, mp3, wav", False, "audio_format")

    content_type = getattr(audio_file, "content_type", None)
    if content_type and content_type not in SUPPORTED_AUDIO_TYPES:
        return LimitResult(False, "Invalid audio content type", False, "audio_type")

    if not validate_audio_magic(audio_file, extension):
        return LimitResult(False, "Invalid audio file signature", False, "audio_signature")

    return LimitResult(True)


def can_upload_recording(
    user: User,
    *,
    file_size_bytes: int,
    duration_seconds: float | None = None,
    question_number: int | None = None,
    replacing_recording=None,
) -> LimitResult:
    from apps.recordings.models import AudioRecording

    limits = get_limits(user)
    quota = sync_recording_usage(user)

    replacement_minutes = ((getattr(replacing_recording, "duration_seconds", None) or 0) / 60)
    replacement_storage = ((getattr(replacing_recording, "file_size_bytes", None) or 0) / (1024 * 1024))
    new_minutes = (duration_seconds or 0) / 60
    new_storage = file_size_bytes / (1024 * 1024)

    projected_minutes = quota.recording_minutes_used - replacement_minutes + new_minutes
    projected_storage = quota.recording_storage_used_mb - replacement_storage + new_storage

    if projected_storage > limits["storage_mb"]:
        return LimitResult(
            False,
            "Storage limit reached",
            not is_premium(user),
            "storage_mb",
            limits["storage_mb"],
            round(projected_storage, 2),
        )

    if duration_seconds is not None and projected_minutes > limits["recording_minutes"]:
        return LimitResult(
            False,
            "Recording minutes limit reached",
            not is_premium(user),
            "recording_minutes",
            limits["recording_minutes"],
            round(projected_minutes, 2),
        )

    if question_number and question_number > 0:
        existing_questions = AudioRecording.objects.filter(user=user).exclude(question_number=0)
        if replacing_recording:
            existing_questions = existing_questions.exclude(id=replacing_recording.id)
        if not AudioRecording.objects.filter(user=user, question_number=question_number).exists():
            projected_questions = existing_questions.count() + 1
            if projected_questions > limits["recording_questions"] or question_number > limits["recording_questions"]:
                return LimitResult(
                    False,
                    f"Free plan includes {FREE_LIMITS['recording_questions']} guided questions",
                    not is_premium(user),
                    "recording_questions",
                    limits["recording_questions"],
                    projected_questions,
                )

    return LimitResult(True)


def record_recording_usage(user: User, action: str, target_id: str, metadata: dict | None = None) -> None:
    sync_recording_usage(user)
    AuditLog.objects.create(
        user=user,
        action=action,
        target_type="audio_recording",
        target_id=target_id,
        metadata=metadata or {},
    )


def can_send_chat_message(ai_owner: User) -> LimitResult:
    quota = get_or_create_quota(ai_owner)
    limits = get_limits(ai_owner)
    used = quota.text_messages_used_this_month
    if used >= limits["text_messages_monthly"]:
        return LimitResult(
            False,
            "Message limit reached",
            not is_premium(ai_owner),
            "text_messages_monthly",
            limits["text_messages_monthly"],
            used,
        )
    return LimitResult(True)


def record_chat_message(ai_owner: User, conversation_id: str | None = None) -> None:
    quota = get_or_create_quota(ai_owner)
    quota.text_messages_used_this_month += 1
    quota.save(update_fields=["text_messages_used_this_month", "updated_at"])
    AuditLog.objects.create(
        user=ai_owner,
        action="chat_message",
        target_type="conversation",
        target_id=conversation_id,
    )


def can_generate_voice_response(ai_owner: User) -> LimitResult:
    if not is_premium(ai_owner):
        return LimitResult(
            False,
            "Voice responses are a Premium feature",
            True,
            "voice_responses_monthly",
            0,
            0,
        )

    quota = get_or_create_quota(ai_owner)
    limits = get_limits(ai_owner)
    used = quota.voice_responses_used_this_month
    if used >= limits["voice_responses_monthly"]:
        return LimitResult(
            False,
            "Voice response limit reached",
            False,
            "voice_responses_monthly",
            limits["voice_responses_monthly"],
            used,
        )
    return LimitResult(True)


def record_voice_response(ai_owner: User, conversation_id: str | None = None) -> None:
    quota = get_or_create_quota(ai_owner)
    quota.voice_responses_used_this_month += 1
    quota.save(update_fields=["voice_responses_used_this_month", "updated_at"])
    AuditLog.objects.create(
        user=ai_owner,
        action="voice_response",
        target_type="conversation",
        target_id=conversation_id,
    )


def can_invite_family_member(ai_owner: User) -> LimitResult:
    limits = get_limits(ai_owner)
    used = FamilyMember.objects.filter(ai_owner=ai_owner).count()
    if used >= limits["family_members"]:
        return LimitResult(
            False,
            "Family invite limit reached",
            not is_premium(ai_owner),
            "family_members",
            limits["family_members"],
            used,
        )
    return LimitResult(True)


def record_family_invite(ai_owner: User, family_member_id: str) -> None:
    quota = get_or_create_quota(ai_owner)
    quota.family_invites_used = FamilyMember.objects.filter(ai_owner=ai_owner).count()
    quota.save(update_fields=["family_invites_used", "updated_at"])
    AuditLog.objects.create(
        user=ai_owner,
        action="family_invite",
        target_type="family_member",
        target_id=family_member_id,
    )


def has_accepted_consent(user: User, consent_type: str) -> bool:
    return ConsentRecord.objects.filter(
        user=user,
        consent_type=consent_type,
        accepted=True,
    ).exists()


def can_clone_voice(user: User) -> LimitResult:
    if not is_premium(user):
        return LimitResult(False, "Voice cloning is a Premium feature", True, "voice_cloning")
    if not has_accepted_consent(user, "voice_cloning"):
        return LimitResult(False, "Voice cloning consent is required", False, "voice_cloning_consent")
    return LimitResult(True)


def record_ai_generation(user: User, target_id: str | None = None) -> None:
    quota = get_or_create_quota(user)
    quota.ai_generations_used += 1
    quota.save(update_fields=["ai_generations_used", "updated_at"])
    AuditLog.objects.create(
        user=user,
        action="ai_generation",
        target_type="ai_configuration",
        target_id=target_id,
    )
