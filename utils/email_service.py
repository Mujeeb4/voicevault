"""
Email service for VoiceVault notifications.
Handles invitation emails, confirmations, and notifications.
"""
import logging
from typing import Optional
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives

logger = logging.getLogger(__name__)

# Email configuration
FROM_EMAIL = settings.DEFAULT_FROM_EMAIL
FRONTEND_URL = settings.FRONTEND_URL


def _log_email_failure(email_type: str, exc: Exception) -> None:
    logger.exception("Failed to send %s email: %s", email_type, exc.__class__.__name__)


def send_invitation_email(
    to_email: str,
    to_name: str,
    ai_owner_name: str,
    relationship: str,
    invitation_link: str,
    personal_message: Optional[str] = None
) -> bool:
    """
    Send invitation email to family member.
    
    Args:
        to_email: Recipient email address
        to_name: Recipient's name
        ai_owner_name: Name of person who created the AI
        relationship: Relationship to AI owner
        invitation_link: Unique invitation link
        personal_message: Optional personal message from AI owner
        
    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        subject = f"{ai_owner_name} invited you to VoiceVault"
        
        # Build email body
        context = {
            'to_name': to_name,
            'ai_owner_name': ai_owner_name,
            'relationship': relationship,
            'invitation_link': invitation_link,
            'personal_message': personal_message,
            'frontend_url': FRONTEND_URL
        }
        
        # HTML email
        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .email-container {{
            background-color: #ffffff;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .logo {{
            font-size: 28px;
            font-weight: bold;
            color: #4F46E5;
            margin-bottom: 10px;
        }}
        .title {{
            font-size: 24px;
            color: #1F2937;
            margin-bottom: 20px;
            font-weight: 600;
        }}
        .message {{
            font-size: 16px;
            color: #4B5563;
            margin-bottom: 20px;
        }}
        .personal-message {{
            background-color: #F3F4F6;
            border-left: 4px solid #4F46E5;
            padding: 16px;
            margin: 24px 0;
            font-style: italic;
            border-radius: 4px;
        }}
        .cta-button {{
            display: inline-block;
            background-color: #4F46E5;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 24px 0;
            text-align: center;
        }}
        .cta-button:hover {{
            background-color: #4338CA;
        }}
        .expiry-note {{
            font-size: 14px;
            color: #6B7280;
            margin-top: 16px;
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 24px;
            border-top: 1px solid #E5E7EB;
            font-size: 14px;
            color: #6B7280;
            text-align: center;
        }}
        .features {{
            background-color: #F9FAFB;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
        }}
        .feature-item {{
            margin: 12px 0;
            padding-left: 24px;
            position: relative;
        }}
        .feature-item:before {{
            content: "✓";
            position: absolute;
            left: 0;
            color: #10B981;
            font-weight: bold;
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">🎙️ VoiceVault</div>
        </div>
        
        <h1 class="title">You've Been Invited!</h1>
        
        <p class="message">
            Hi <strong>{to_name}</strong>,
        </p>
        
        <p class="message">
            <strong>{ai_owner_name}</strong> has invited you to chat with their AI assistant on VoiceVault.
        </p>
        
        {'<div class="personal-message">' + personal_message + '</div>' if personal_message else ''}
        
        <div class="features">
            <strong>What is VoiceVault?</strong>
            <div class="feature-item">Chat with {ai_owner_name}'s AI anytime, anywhere</div>
            <div class="feature-item">Hear responses in their actual voice</div>
            <div class="feature-item">Get guidance, advice, and connection</div>
            <div class="feature-item">Personal stories and memories preserved forever</div>
        </div>
        
        <p class="message">
            This AI speaks in <strong>{ai_owner_name}'s actual voice</strong> and can answer your questions,
            share stories, and provide guidance based on their life experiences and personality.
        </p>
        
        <div style="text-align: center;">
            <a href="{invitation_link}" class="cta-button">
                Accept Invitation
            </a>
        </div>
        
        <p class="expiry-note">
            This invitation link expires in 7 days.
        </p>
        
        <div class="footer">
            <p>
                This invitation was sent by {ai_owner_name} through VoiceVault.
                <br>
                If you did not expect this invitation, you can safely ignore this email.
            </p>
            <p style="margin-top: 16px;">
                <a href="{FRONTEND_URL}" style="color: #4F46E5; text-decoration: none;">Visit VoiceVault</a>
            </p>
        </div>
    </div>
</body>
</html>
"""
        
        # Plain text version
        text_message = f"""
Hi {to_name},

{ai_owner_name} has invited you to chat with their AI assistant on VoiceVault.

{personal_message if personal_message else ''}

What is VoiceVault?
• Chat with {ai_owner_name}'s AI anytime, anywhere
• Hear responses in their actual voice
• Get guidance, advice, and connection
• Personal stories and memories preserved forever

This AI speaks in {ai_owner_name}'s actual voice and can answer your questions,
share stories, and provide guidance based on their life experiences and personality.

Accept Invitation:
{invitation_link}

This invitation link expires in 7 days.

---
This invitation was sent by {ai_owner_name} through VoiceVault.
If you did not expect this invitation, you can safely ignore this email.

Visit VoiceVault: {FRONTEND_URL}
"""
        
        # Send email
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=FROM_EMAIL,
            to=[to_email]
        )
        email.attach_alternative(html_message, "text/html")
        email.send()
        
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
    """
    Send confirmation email to AI owner when family member accepts invitation.
    
    Args:
        to_email: AI owner's email
        family_member_name: Name of family member who accepted
        relationship: Their relationship
        
    Returns:
        True if sent successfully
    """
    try:
        subject = f"{family_member_name} accepted your VoiceVault invitation"
        
        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .success-icon {{
            text-align: center;
            font-size: 48px;
            margin-bottom: 20px;
        }}
        .title {{
            font-size: 24px;
            color: #10B981;
            text-align: center;
            margin-bottom: 20px;
        }}
        .message {{
            font-size: 16px;
            color: #4B5563;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1 class="title">Great News!</h1>
        <p class="message">
            <strong>{family_member_name}</strong> ({relationship}) has accepted your invitation
            and can now chat with your AI assistant.
        </p>
        <p class="message" style="margin-top: 24px; color: #6B7280;">
            They can start conversations anytime through VoiceVault.
        </p>
    </div>
</body>
</html>
"""
        
        text_message = f"""
Great News!

{family_member_name} ({relationship}) has accepted your invitation
and can now chat with your AI assistant.

They can start conversations anytime through VoiceVault.
"""
        
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=FROM_EMAIL,
            to=[to_email]
        )
        email.attach_alternative(html_message, "text/html")
        email.send()
        
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
    """
    Send notification when access is removed.
    
    Args:
        to_email: Family member's email
        to_name: Family member's name
        ai_owner_name: AI owner's name
        
    Returns:
        True if sent successfully
    """
    try:
        subject = f"VoiceVault Access Update"
        
        text_message = f"""
Hi {to_name},

{ai_owner_name} has removed your access to their VoiceVault AI assistant.

You will no longer be able to chat with their AI.

If you believe this was a mistake, please contact {ai_owner_name} directly.

Best regards,
VoiceVault Team
"""
        
        send_mail(
            subject=subject,
            message=text_message,
            from_email=FROM_EMAIL,
            recipient_list=[to_email],
            fail_silently=False
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
    """
    Send welcome email after accepting invitation.
    
    Args:
        to_email: Family member's email
        to_name: Family member's name
        ai_owner_name: AI owner's name
        
    Returns:
        True if sent successfully
    """
    try:
        subject = f"Welcome to {ai_owner_name}'s VoiceVault"
        
        html_message = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }}
        .container {{
            background-color: #ffffff;
            border-radius: 12px;
            padding: 32px;
        }}
        .title {{
            font-size: 24px;
            color: #4F46E5;
            margin-bottom: 20px;
        }}
        .cta {{
            background-color: #4F46E5;
            color: #ffffff;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 8px;
            display: inline-block;
            margin: 20px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1 class="title">🎉 Welcome, {to_name}!</h1>
        <p>You now have access to chat with <strong>{ai_owner_name}'s AI assistant</strong>.</p>
        <p>Start a conversation anytime and hear responses in their actual voice.</p>
        <a href="{FRONTEND_URL}/chat" class="cta">Start Chatting</a>
        <p style="margin-top: 24px; color: #6B7280;">
            Tips:
            <br>• Ask about their life experiences
            <br>• Seek advice and guidance
            <br>• Listen to their stories
            <br>• Rate conversations to help improve responses
        </p>
    </div>
</body>
</html>
"""
        
        text_message = f"""
Welcome, {to_name}!

You now have access to chat with {ai_owner_name}'s AI assistant.

Start a conversation anytime and hear responses in their actual voice.

Visit: {FRONTEND_URL}/chat

Tips:
• Ask about their life experiences
• Seek advice and guidance
• Listen to their stories
• Rate conversations to help improve responses

Best regards,
VoiceVault Team
"""
        
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_message,
            from_email=FROM_EMAIL,
            to=[to_email]
        )
        email.attach_alternative(html_message, "text/html")
        email.send()
        
        logger.info(f"Welcome email sent to {to_email}")
        return True
        
    except Exception as e:
        _log_email_failure("welcome", e)
        return False
