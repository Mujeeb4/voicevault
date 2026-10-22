/**
 * Family API - invitations and accessible AIs
 */
import apiClient from './client';
import type { FamilyMember, InviteRequest, InviteResponse, UsageQuotaStatus } from '@/types';

const baseUrl = '/family';

export const familyApi = {
  getFamilyMembers: async (): Promise<{ count: number; members: FamilyMember[] }> => {
    const { data } = await apiClient.get(baseUrl + '/members/');
    return {
      count: data.count ?? data.members?.length ?? 0,
      members: data.members ?? data.results ?? [],
    };
  },

  inviteFamilyMember: async (request: InviteRequest): Promise<InviteResponse> => {
    const { data } = await apiClient.post(baseUrl + '/invite/', {
      ...request,
      personal_message: request.message,
    });
    return {
      invitation_id: data.family_member_id,
      invitation_token: data.invitation_token ?? '',
      invitation_link: data.invitation_link ?? '',
      expires_at: data.expires_at ?? '',
    };
  },

  removeFamilyMember: async (memberId: string): Promise<void> => {
    await apiClient.delete(`${baseUrl}/members/${memberId}/`);
  },

  resendInvitation: async (memberId: string): Promise<InviteResponse> => {
    const { data } = await apiClient.post(`${baseUrl}/members/${memberId}/resend/`);
    return {
      invitation_id: data.family_member_id ?? memberId,
      invitation_token: data.invitation_token ?? '',
      invitation_link: data.invitation_link ?? '',
      expires_at: data.expires_at ?? '',
    };
  },

  getAccessibleAIs: async (): Promise<{
    results: Array<{
      id: string;
      full_name: string;
      ai_ready: boolean;
      relationship: string;
      invitation_accepted_at: string;
      plan_type?: 'free' | 'premium';
      is_premium?: boolean;
      voice_enabled?: boolean;
      usage_quota?: UsageQuotaStatus;
    }>;
  }> => {
    const { data } = await apiClient.get(baseUrl + '/accessible-ais/');
    return {
      results: data.results ?? data ?? [],
    };
  },

  acceptInvitation: async (token: string): Promise<{ message: string; redirect_url: string }> => {
    const { data } = await apiClient.post(`${baseUrl}/accept-invite/${encodeURIComponent(token)}/`, {});
    return {
      message: data.message ?? 'Invitation accepted',
      redirect_url: `/chat/${data.ai_owner.id}`,
    };
  },

  getInvitationDetails: async (
    token: string
  ): Promise<{ ai_owner: { id: string; full_name: string }; invitee_email: string; invitee_name: string; relationship?: string; is_expired?: boolean; already_accepted?: boolean }> => {
    const { data } = await apiClient.get(`${baseUrl}/invitation/${token}/`);
    return data;
  },
};
