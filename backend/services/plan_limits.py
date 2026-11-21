"""
Plan limits and quota enforcement for VoiceVault freemium.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from django.conf import settings
from django.db.models import F, Sum
from django.utils import timezone

from apps.users.models import AuditLog, ConsentRecord, FamilyMember, UsageQuota, User
from utils.security import validate_audio_magic


# family_members comes from settings (FREE_/PREMIUM_MAX_FAMILY_MEMBERS) in get_limits()
FREE_LIMITS = {
    "recording_questions": 5,
    "recording_minutes": 15,
    "text_messages_monthly": 5,
    "voice_responses_monthly": 0,
    "storage_mb": 500,
    "ai_generations": 1,
}

# Premium chat has no monthly caps: each family member gets a lifetime question
# allowance (PREMIUM_QUESTIONS_PER_FAMILY_MEMBER) and then uses purchased credits.
PREMIUM_LIMITS = {
    "recording_questions": 30,
    "recording_minutes": 300,
    "storage_mb": 5000,
    "ai_generations": 3,
}

# Where a reserved question was taken from, so a failed answer can be refunded
QUESTION_SOURCE_FREE_PLAN = "free_plan"
QUESTION_SOURCE_INCLUDED = "included"
QUESTION_SOURCE_CREDIT = "credit"

SUPPORTED_AUDIO_EXTENSIONS = {"webm", "mp3", "wav", "m4a", "mp4", "aac", "ogg"}
SUPPORTED_AUDIO_TYPES = {
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/aac",
    "audio/x-aac",
    "audio/ogg",
    "video/mp4",
    "video/webm",
}


@dataclass
class LimitResult:
    allowed: bool
    message: str = ""
    upgrade_required: bool = False
    limit_key: str | None = None
    limit: int | float | None = None
    used: int | float | None = None
    credits_required: bool = False

    def as_error(self) -> dict:
        return {
            "error": self.message,
            "message": self.message,
            "upgrade_required": self.upgrade_required,
            "credits_required": self.credits_required,
            "limit_key": self.limit_key,
            "limit": self.limit,
            "used": self.used,
            "upgrade_url": "/pricing" if self.upgrade_required else None,
        }


def is_premium(user: User) -> bool:
    return bool(getattr(user, "has_premium_access", False))


def get_limits(user: User) -> dict:
    if is_premium(user):
        limits = dict(PREMIUM_LIMITS)
        limits["family_members"] = settings.PREMIUM_MAX_FAMILY_MEMBERS
        limits["questions_per_family_member"] = settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER
    else:
        limits = dict(FREE_LIMITS)
        limits["family_members"] = settings.FREE_MAX_FAMILY_MEMBERS
    return limits


def invited_family_members(ai_owner: User):
    """Family members counted against the invite limit; the owner's own chat record is not one."""
    return FamilyMember.objects.filter(ai_owner=ai_owner).exclude(relationship="self")


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
            "family_invites_used": invited_family_members(user).count(),
            "ai_generations_used": quota.ai_generations_used,
            "quota_reset_date": quota.quota_reset_date.isoformat() if quota.quota_reset_date else None,
        },
    }


def validate_audio_file(audio_file) -> LimitResult:
    file_name = getattr(audio_file, "name", "") or ""
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if extension not in SUPPORTED_AUDIO_EXTENSIONS:
        return LimitResult(False, "Invalid file format. Allowed: webm, mp3, wav, m4a, mp4, aac, ogg", False, "audio_format")

    content_type = (getattr(audio_file, "content_type", None) or "").split(";", 1)[0].strip().lower()
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

    # An unknown duration counts as over the limit rather than skipping the check
    if duration_seconds is None or projected_minutes > limits["recording_minutes"]:
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


def _reserve_free_message(ai_owner: User) -> LimitResult:
    """Count one free-plan message with a single conditional UPDATE, so parallel requests can't exceed the cap."""
    quota = get_or_create_quota(ai_owner)  # also starts a new month when due
    limit = get_limits(ai_owner)["text_messages_monthly"]
    if UsageQuota.objects.filter(pk=quota.pk, text_messages_used_this_month__lt=limit).update(
        text_messages_used_this_month=F("text_messages_used_this_month") + 1, updated_at=timezone.now()
    ):
        return LimitResult(True)
    return LimitResult(False, "Message limit reached", True, "text_messages_monthly", limit, limit)


def record_chat_message(ai_owner: User, conversation_id: str | None = None) -> None:
    # Free-plan messages were already counted when reserved; Premium ones are counted here for stats
    if is_premium(ai_owner):
        quota = get_or_create_quota(ai_owner)
        UsageQuota.objects.filter(pk=quota.pk).update(
            text_messages_used_this_month=F("text_messages_used_this_month") + 1, updated_at=timezone.now()
        )
    AuditLog.objects.create(
        user=ai_owner,
        action="chat_message",
        target_type="conversation",
        target_id=conversation_id,
    )


def question_allowance(family_member: FamilyMember) -> dict:
    """Included questions and purchased credits left for one family member of a Premium vault."""
    included = settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER
    used = min(family_member.included_questions_used, included)
    included_remaining = included - used
    return {
        "included_questions": included,
        "included_questions_used": used,
        "included_questions_remaining": included_remaining,
        "credit_balance": family_member.credit_balance,
        "questions_remaining": included_remaining + family_member.credit_balance,
        "credit_unit_price_cents": settings.CREDIT_UNIT_PRICE_CENTS,
        "credit_min_purchase": settings.CREDIT_MIN_PURCHASE,
        "credit_max_purchase": settings.CREDIT_MAX_PURCHASE,
        "currency": settings.STRIPE_PREMIUM_CURRENCY,
    }


def reserve_question(ai_owner: User, family_member: FamilyMember) -> tuple[LimitResult, str | None]:
    """
    Take one question before the AI answers.

    Premium vaults use the member's included questions first, then purchased credits.
    Each step is a single conditional UPDATE, so concurrent questions can't overdraw.
    Free vaults keep the vault-wide monthly message limit, counted atomically here.
    Returns the source to pass to refund_question() if the answer fails.
    """
    if not is_premium(ai_owner):
        result = _reserve_free_message(ai_owner)
        return result, QUESTION_SOURCE_FREE_PLAN if result.allowed else None
    if family_member is None:
        return LimitResult(False, "Unable to check your question allowance. Please try again.",
                           False, "question_credits"), None

    included = settings.PREMIUM_QUESTIONS_PER_FAMILY_MEMBER
    members = FamilyMember.objects.filter(pk=family_member.pk)
    if members.filter(included_questions_used__lt=included).update(
        included_questions_used=F("included_questions_used") + 1
    ):
        return LimitResult(True), QUESTION_SOURCE_INCLUDED
    if members.filter(credit_balance__gt=0).update(credit_balance=F("credit_balance") - 1):
        return LimitResult(True), QUESTION_SOURCE_CREDIT
    return LimitResult(
        False,
        f"You've used your {included} included questions. Buy credits to keep talking.",
        False,
        "question_credits",
        included,
        included,
        credits_required=True,
    ), None


def refund_question(family_member: FamilyMember, source: str | None, ai_owner: User | None = None) -> None:
    """Give back a question reserved for an answer that was never delivered."""
    if source == QUESTION_SOURCE_FREE_PLAN and ai_owner is not None:
        UsageQuota.objects.filter(user=ai_owner, text_messages_used_this_month__gt=0).update(
            text_messages_used_this_month=F("text_messages_used_this_month") - 1, updated_at=timezone.now()
        )
        return
    if family_member is None:
        return
    members = FamilyMember.objects.filter(pk=family_member.pk)
    if source == QUESTION_SOURCE_INCLUDED:
        members.filter(included_questions_used__gt=0).update(
            included_questions_used=F("included_questions_used") - 1
        )
    elif source == QUESTION_SOURCE_CREDIT:
        members.update(credit_balance=F("credit_balance") + 1)


def add_question_credits(family_member: FamilyMember, credits: int) -> None:
    FamilyMember.objects.filter(pk=family_member.pk).update(credit_balance=F("credit_balance") + credits)


def can_generate_voice_response(ai_owner: User) -> LimitResult:
    # On Premium the voice answer is part of the question already paid for
    if not is_premium(ai_owner):
        return LimitResult(
            False,
            "Voice responses are a Premium feature",
            True,
            "voice_responses_monthly",
            0,
            0,
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
    used = invited_family_members(ai_owner).count()
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
    quota.family_invites_used = invited_family_members(ai_owner).count()
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
