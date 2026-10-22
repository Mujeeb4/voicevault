"""
Email service for VoiceVault notifications.
Handles invitation emails, confirmations, account and payment notifications.

All emails share one table-based, inline-CSS layout (templates/emails) styled
with the frontend brand palette, and always carry a plain-text alternative.
"""
import logging
from typing import Optional
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# Email configuration
FROM_EMAIL = settings.DEFAULT_FROM_EMAIL
FRONTEND_URL = settings.FRONTEND_URL


def _log_email_failure(email_type: str, exc: Exception) -> None:
    logger.exception("Failed to send %s email: %s", email_type, exc.__class__.__name__)


def _send_branded_email(
    to_email: str,
    subject: str,
    heading: str,
    paragraphs: list,
    *,
    preheader: str = "",
    quote: Optional[str] = None,
    details: Optional[list] = None,
    bullets: Optional[list] = None,
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    note: Optional[str] = None,
    footer_note: Optional[str] = None,
) -> None:
    """Render the shared layout (HTML + text) and send. Raises on failure."""
    context = {
        "heading": heading,
        "paragraphs": paragraphs,
        "preheader": preheader or (paragraphs[0] if paragraphs else heading),
        "quote": quote,
        "details": details or [],
        "bullets": bullets or [],
        "cta_label": cta_label,
        "cta_url": cta_url,
        "note": note,
        "footer_note": footer_note,
        "frontend_url": FRONTEND_URL,
        "logo_url": f"{FRONTEND_URL}/logo.png",
    }
    email = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string("emails/message.txt", context),
        from_email=FROM_EMAIL,
        to=[to_email],
    )
    email.attach_alternative(render_to_string("emails/message.html", context), "text/html")
    email.send()


def _format_amount(amount_cents: Optional[int], currency: str = "usd") -> str:
    if amount_cents is None:
        return ""
    symbols = {"USD": "$", "CAD": "C$", "GBP": "\u00a3", "EUR": "\u20ac"}
    code = (currency or "usd").upper()
    return f"{symbols.get(code, code + ' ')}{amount_cents / 100:,.2f}"


def send_invitation_email(
    to_email: str,
    to_name: str,
    ai_owner_name: str,
    relationship: str,
    invitation_link: str,
    personal_message: Optional[str] = None
) -> bool:
    """Send invitation email to a family member. Returns True if sent."""
    try:
        _send_branded_email(
            to_email,
            f"{ai_owner_name} invited you to VoiceVault",
            "You've been invited",
            [
                f"Hi {to_name},",
                f"{ai_owner_name} has invited you to chat with their AI assistant on VoiceVault. "
                f"It speaks in {ai_owner_name}'s actual voice and can answer your questions, "
                "share stories, and offer guidance based on their life experiences.",
            ],
            quote=personal_message or None,
            bullets=[
                f"Chat with {ai_owner_name}'s AI anytime, anywhere",
                "Hear responses in their actual voice",
                "Get guidance, advice, and connection",
                "Personal stories and memories preserved forever",
            ],
            cta_label="Accept invitation",
            cta_url=invitation_link,
            note="This invitation link expires in 7 days.",
            footer_note=(
                f"This invitation was sent by {ai_owner_name} through VoiceVault. "
                "If you did not expect it, you can safely ignore this email."
            ),
        )
        logger.info(f"Invitation email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("invitation", e)
        return False


def send_invitation_accepted_email(
    to_email: str,
    family_member_name: str,
    relationship: str
) -> bool:
    """Tell the AI owner a family member accepted their invitation."""
    try:
        _send_branded_email(
            to_email,
            f"{family_member_name} accepted your VoiceVault invitation",
            "Great news!",
            [
                f"{family_member_name} ({relationship}) has accepted your invitation "
                "and can now chat with your AI assistant.",
                "They can start conversations anytime through VoiceVault.",
            ],
            cta_label="Open VoiceVault",
            cta_url=f"{FRONTEND_URL}/dashboard",
        )
        logger.info(f"Acceptance confirmation sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("acceptance", e)
        return False


def send_access_removed_email(
    to_email: str,
    to_name: str,
    ai_owner_name: str
) -> bool:
    """Notify a family member that their access was removed."""
    try:
        _send_branded_email(
            to_email,
            "VoiceVault Access Update",
            "Your access has changed",
            [
                f"Hi {to_name},",
                f"{ai_owner_name} has removed your access to their VoiceVault AI assistant. "
                "You will no longer be able to chat with their AI.",
                f"If you believe this was a mistake, please contact {ai_owner_name} directly.",
            ],
        )
        logger.info(f"Access removed email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("access removed", e)
        return False


def send_welcome_email(
    to_email: str,
    to_name: str,
    ai_owner_name: str
) -> bool:
    """Welcome a family member after they accept an invitation."""
    try:
        _send_branded_email(
            to_email,
            f"Welcome to {ai_owner_name}'s VoiceVault",
            f"Welcome, {to_name}!",
            [
                f"You now have access to chat with {ai_owner_name}'s AI assistant.",
                "Start a conversation anytime and hear responses in their actual voice.",
            ],
            bullets=[
                "Ask about their life experiences",
                "Seek advice and guidance",
                "Listen to their stories",
                "Rate conversations to help improve responses",
            ],
            cta_label="Start chatting",
            cta_url=f"{FRONTEND_URL}/chat",
        )
        logger.info(f"Welcome email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("welcome", e)
        return False


def send_verification_email(to_email: str, to_name: str, verify_url: str) -> bool:
    """Ask a new user to confirm their email address."""
    try:
        first = (to_name or "").split(" ")[0] or "there"
        _send_branded_email(
            to_email,
            "Verify your email for VoiceVault",
            "Verify your email",
            [
                f"Hi {first}, thanks for signing up for VoiceVault.",
                "Please confirm your email address to activate your account. "
                "This link expires in 24 hours and can only be used once.",
            ],
            cta_label="Verify email",
            cta_url=verify_url,
            note=f"If the button does not work, copy this link into your browser: {verify_url}",
            footer_note="You received this email because an account was created with this address. "
                        "If that was not you, you can ignore it.",
        )
        logger.info("Verification email sent")
        return True
    except Exception as e:
        _log_email_failure("verification", e)
        return False


def send_account_welcome_email(to_email: str, to_name: str) -> bool:
    """Welcome a user right after they create an account."""
    try:
        first = (to_name or "").split(" ")[0] or "there"
        _send_branded_email(
            to_email,
            "Welcome to VoiceVault",
            f"Welcome, {first}!",
            [
                "Your VoiceVault account is ready. Capture your stories and your voice "
                "so the people you love can hear from you for years to come.",
            ],
            bullets=[
                "Answer guided questions in your own voice",
                "Invite family members to chat with your AI",
                "Upgrade any time for voice cloning and more memories",
            ],
            cta_label="Get started",
            cta_url=f"{FRONTEND_URL}/dashboard",
            footer_note="You received this email because an account was created with this address.",
        )
        logger.info(f"Account welcome email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("account welcome", e)
        return False


def send_premium_activated_email(
    to_email: str,
    to_name: str,
    amount_cents: Optional[int] = None,
    currency: str = "usd",
    receipt_url: Optional[str] = None,
) -> bool:
    """Confirm a successful Premium purchase (receipt)."""
    try:
        details = [("Plan", "VoiceVault Premium (lifetime)")]
        if amount_cents is not None:
            details.append(("Amount paid", _format_amount(amount_cents, currency)))
        paragraphs = [
            f"Hi {to_name or 'there'},",
            "Thank you for your purchase. VoiceVault Premium is now active on your account.",
        ]
        if receipt_url:
            paragraphs.append(f"Your Stripe receipt: {receipt_url}")
        _send_branded_email(
            to_email,
            "Your VoiceVault Premium is active",
            "Premium is active",
            paragraphs,
            details=details,
            bullets=[
                "Voice cloning included",
                "Up to 5 hours of memories",
                "Up to 10 family members",
                "Biography PDF export",
            ],
            cta_label="Go to your vault",
            cta_url=f"{FRONTEND_URL}/dashboard",
        )
        logger.info(f"Premium activated email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("premium activated", e)
        return False


def send_payment_failed_email(to_email: str, to_name: str) -> bool:
    """Tell a user their payment did not go through."""
    try:
        _send_branded_email(
            to_email,
            "Your VoiceVault payment didn't go through",
            "Payment unsuccessful",
            [
                f"Hi {to_name or 'there'},",
                "We couldn't process your payment for VoiceVault Premium, so no charge was completed "
                "and your plan has not changed.",
                "You can try again with the same or a different card.",
            ],
            cta_label="Try again",
            cta_url=f"{FRONTEND_URL}/pricing",
            note="If you didn't try to make a purchase, you can ignore this email.",
        )
        logger.info(f"Payment failed email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("payment failed", e)
        return False


def send_password_changed_email(to_email: str, to_name: str) -> bool:
    """Security notice after the password has been changed."""
    try:
        _send_branded_email(
            to_email,
            "Your VoiceVault password was changed",
            "Password changed",
            [
                f"Hi {to_name or 'there'},",
                "The password for your VoiceVault account was just changed.",
                "If this was you, no further action is needed. If it wasn't, please contact "
                "us right away at info@voicevault.life.",
            ],
            cta_label="Open VoiceVault",
            cta_url=f"{FRONTEND_URL}/login",
        )
        logger.info(f"Password changed email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("password changed", e)
        return False


def send_password_reset_email(to_email: str, to_name: str, reset_url: str) -> bool:
    """One-time password reset link (valid for one hour)."""
    try:
        _send_branded_email(
            to_email,
            "Reset your VoiceVault password",
            "Reset your password",
            [
                f"Hi {to_name or 'there'},",
                "We received a request to reset the password for your VoiceVault account. "
                "Use the button below to choose a new one. The link works once and expires in 1 hour.",
            ],
            cta_label="Reset password",
            cta_url=reset_url,
            note="If you didn't ask for this, you can safely ignore this email. Your password won't change.",
        )
        logger.info(f"Password reset email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("password reset", e)
        return False


def send_account_deleted_email(to_email: str, to_name: str) -> bool:
    """Confirmation that the account and its data are being permanently deleted."""
    try:
        _send_branded_email(
            to_email,
            "Your VoiceVault account was deleted",
            "Account deleted",
            [
                f"Hi {to_name or 'there'},",
                "Your VoiceVault account, recordings, AI voice and conversations have been permanently deleted.",
                "If you didn't do this, please contact us right away at info@voicevault.life.",
            ],
        )
        logger.info(f"Account deleted email sent to {to_email}")
        return True
    except Exception as e:
        _log_email_failure("account deleted", e)
        return False
