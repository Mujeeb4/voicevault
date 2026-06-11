/**
 * Family Management Store (Zustand)
 * Manages family member invitations and access control
 * Following .cursorrules patterns
 */

import { create } from 'zustand';
import type { FamilyMember, InviteRequest, InviteResponse, RelationshipType } from '@/types';
import { familyApi } from '@/lib/api/family';
import { toast } from 'sonner';

interface FamilyState {
  // State
  familyMembers: FamilyMember[];
  accessibleAIs: Array<{
    id: string;
    full_name: string;
    ai_ready: boolean;
    relationship: string;
    invitation_accepted_at: string;
  }>;
  isLoading: boolean;
  error: string | null;
  lastInvitation: InviteResponse | null;

  // Actions
  loadFamilyMembers: () => Promise<void>;
  inviteMember: (request: InviteRequest) => Promise<InviteResponse | null>;
  removeMember: (memberId: string) => Promise<void>;
  resendInvitation: (memberId: string) => Promise<void>;
  loadAccessibleAIs: () => Promise<void>;
  updateMember: (memberId: string, updates: { relationship?: RelationshipType; has_access?: boolean }) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  familyMembers: [],
  accessibleAIs: [],
  isLoading: false,
  error: null,
  lastInvitation: null,
};

export const useFamilyStore = create<FamilyState>()((set, get) => ({
  ...initialState,

  /**
   * Load family members (AI Owner only)
   * Gets all members invited by the current user
   */
  loadFamilyMembers: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await familyApi.getFamilyMembers();
      // Backend returns { count, members } - use members with fallback
      set({ familyMembers: response.members || [], isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load family members';
      set({ error: errorMessage, isLoading: false, familyMembers: [] });
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Invite a family member
   * Creates invitation and returns link to share
   */
  inviteMember: async (request: InviteRequest): Promise<InviteResponse | null> => {
    try {
      set({ isLoading: true, error: null });

      // Validate input
      if (!request.email || !request.full_name || !request.relationship) {
        throw new Error('All fields are required');
      }

      const response = await familyApi.inviteFamilyMember(request);

      set({ lastInvitation: response, isLoading: false });

      // Reload family members to show new invitation
      await get().loadFamilyMembers();

      toast.success(`Invitation sent to ${request.email}!`);
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to invite family member';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      return null;
    }
  },

  /**
   * Remove a family member
   * Revokes their access to chat with AI
   */
  removeMember: async (memberId: string) => {
    try {
      set({ isLoading: true, error: null });

      await familyApi.removeFamilyMember(memberId);

      // Remove from local state
      set((state) => ({
        familyMembers: state.familyMembers.filter((m) => m.id !== memberId),
        isLoading: false,
      }));

      toast.success('Family member removed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove family member';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Resend invitation to pending member
   * Generates new token and link
   */
  resendInvitation: async (memberId: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await familyApi.resendInvitation(memberId);

      set({ lastInvitation: response, isLoading: false });

      toast.success('Invitation resent! New link generated.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend invitation';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Load accessible AIs (Family Member view)
   * Gets AIs the logged-in user can chat with
   * SECURITY: Only returns AIs where has_access=true
   */
  loadAccessibleAIs: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await familyApi.getAccessibleAIs();
      set({ accessibleAIs: response.results, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load accessible AIs';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  /**
   * Update family member
   * Can change relationship or revoke access
   */
  updateMember: async (memberId: string, updates: { relationship?: RelationshipType; has_access?: boolean }) => {
    try {
      set({ isLoading: true, error: null });

      const updatedMember = await familyApi.updateFamilyMember(memberId, updates);

      // Update local state
      set((state) => ({
        familyMembers: state.familyMembers.map((m) => (m.id === memberId ? updatedMember : m)),
        isLoading: false,
      }));

      toast.success('Family member updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update family member';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));

