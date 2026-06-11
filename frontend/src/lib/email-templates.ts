/**
 * Email Templates for Family Invitations
 * Helper functions to generate email content
 * Following .cursorrules patterns
 */

export interface InvitationEmailData {
  senderName: string;
  recipientName: string;
  relationship: string;
  invitationLink: string;
  personalMessage?: string;
  expiresAt: string;
}

/**
 * Generate email subject line
 */
export const getInvitationEmailSubject = (senderName: string): string => {
  return `${senderName} invited you to VoiceVault`;
};

/**
 * Generate email body (HTML)
 */
export const getInvitationEmailHTML = (data: InvitationEmailData): string => {
  const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VoiceVault Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #faf8f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #9a7b4f;
      margin-bottom: 10px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      color: #1f2937;
      margin: 20px 0;
    }
    .content {
      margin: 20px 0;
      color: #4b5563;
    }
    .message-box {
      background-color: #f8f6f2;
      border-left: 4px solid #9a7b4f;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .button {
      display: inline-block;
      background-color: #9a7b4f;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background-color: #8a6845;
    }
    .link {
      word-break: break-all;
      color: #9a7b4f;
      text-decoration: none;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 14px;
      color: #6b7280;
      text-align: center;
    }
    .warning {
      background-color: #fef3c7;
      border-left: 4px solid: #f59e0b;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎤 VoiceVault</div>
      <h1 class="title">You've Been Invited!</h1>
    </div>

    <div class="content">
      <p>Hi ${data.recipientName},</p>
      
      <p>
        <strong>${data.senderName}</strong> has invited you to chat with their AI personality on VoiceVault.
        You've been added as their <strong>${getRelationshipLabel(data.relationship)}</strong>.
      </p>

      ${data.personalMessage
      ? `
      <div class="message-box">
        <strong>Personal Message:</strong>
        <p style="margin: 10px 0 0 0;">${data.personalMessage}</p>
      </div>
      `
      : ''
    }

      <p>
        VoiceVault allows people to create an AI version of themselves that their family and friends can chat with.
        You'll be able to have conversations and hear responses in ${data.senderName}'s voice!
      </p>

      <div style="text-align: center;">
        <a href="${data.invitationLink}" class="button">
          Accept Invitation
        </a>
      </div>

      <p style="font-size: 14px; color: #6b7280;">
        Or copy and paste this link into your browser:<br>
        <a href="${data.invitationLink}" class="link">${data.invitationLink}</a>
      </p>

      <div class="warning">
        <strong>⏰ This invitation expires on ${expiryDate}</strong>
      </div>

      <p style="font-size: 14px; color: #6b7280;">
        <strong>Note:</strong> You'll be able to chat with ${data.senderName}'s AI, but you won't be able to modify their voice, personality, or settings. This ensures their AI remains authentic to them.
      </p>
    </div>

    <div class="footer">
      <p>
        This invitation was sent by ${data.senderName} through VoiceVault.<br>
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
      <p style="margin-top: 16px;">
        <a href="https://voicevault.com" style="color: #9a7b4f; text-decoration: none;">Visit VoiceVault</a> · 
        <a href="https://voicevault.com/privacy" style="color: #9a7b4f; text-decoration: none;">Privacy Policy</a> · 
        <a href="https://voicevault.com/terms" style="color: #9a7b4f; text-decoration: none;">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Generate email body (Plain Text)
 */
export const getInvitationEmailText = (data: InvitationEmailData): string => {
  const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
VoiceVault Invitation

Hi ${data.recipientName},

${data.senderName} has invited you to chat with their AI personality on VoiceVault.
You've been added as their ${getRelationshipLabel(data.relationship)}.

${data.personalMessage ? `Personal Message:\n${data.personalMessage}\n\n` : ''}

VoiceVault allows people to create an AI version of themselves that their family and friends can chat with. You'll be able to have conversations and hear responses in ${data.senderName}'s voice!

Accept Invitation:
${data.invitationLink}

⏰ This invitation expires on ${expiryDate}

Note: You'll be able to chat with ${data.senderName}'s AI, but you won't be able to modify their voice, personality, or settings. This ensures their AI remains authentic to them.

---

This invitation was sent by ${data.senderName} through VoiceVault.
If you didn't expect this invitation, you can safely ignore this email.

Visit VoiceVault: https://voicevault.com
Privacy Policy: https://voicevault.com/privacy
Terms of Service: https://voicevault.com/terms
  `.trim();
};

/**
 * Helper: Get relationship label
 */
const getRelationshipLabel = (relationship: string): string => {
  const labels: Record<string, string> = {
    spouse: 'Spouse/Partner',
    child: 'Child',
    parent: 'Parent',
    sibling: 'Sibling',
    friend: 'Friend',
  };
  return labels[relationship] || relationship;
};

/**
 * Generate mailto: link for invitation
 */
export const getMailtoLink = (data: InvitationEmailData): string => {
  const subject = encodeURIComponent(getInvitationEmailSubject(data.senderName));
  const body = encodeURIComponent(getInvitationEmailText(data));

  return `mailto:${data.recipientName}?subject=${subject}&body=${body}`;
};

