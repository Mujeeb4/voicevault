/**
 * Core type definitions for VoiceVault frontend
 * Based on FRONTEND_PLAN.md API specifications
 */

// ============================================================================
// User & Auth Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  created_at: string;
  recording_completed: boolean;
  ai_ready: boolean;
  package_tier?: 'free' | 'premium';
  plan_type?: 'free' | 'premium';
  is_premium?: boolean;
  lifetime_access?: boolean;
  premium_purchased_at?: string | null;
  payment_completed?: boolean;
  usage_quota?: UsageQuotaStatus;
  is_admin?: boolean;
}

export interface UsageQuotaStatus {
  plan_type: 'free' | 'premium';
  is_premium: boolean;
  limits: {
    recording_questions: number;
    recording_minutes: number;
    text_messages_monthly: number;
    voice_responses_monthly: number;
    family_members: number;
    storage_mb: number;
    ai_generations: number;
  };
  usage: {
    recording_minutes_used: number;
    recording_storage_used_mb: number;
    text_messages_used_this_month: number;
    voice_responses_used_this_month: number;
    family_invites_used: number;
    ai_generations_used: number;
    quota_reset_date: string | null;
  };
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// ============================================================================
// Question Types
// ============================================================================

export type QuestionDomain =
  | 'childhood'
  | 'family'
  | 'career'
  | 'wisdom'
  | 'challenges'
  | 'personality';

export interface Question {
  id: string;
  question_text: string;
  domain: QuestionDomain;
  order: number;
  tip?: string;
  suggested_duration_seconds: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateQuestionRequest {
  question_text: string;
  domain: QuestionDomain;
  order: number;
  tip?: string;
  suggested_duration_seconds: number;
  is_active: boolean;
}

// ============================================================================
// Recording Types
// ============================================================================

export interface RecordingData {
  blob: Blob;
  duration: number;
  timestamp: Date;
}

export interface UploadRequest {
  audio_file: File;
  file_format: 'mp3' | 'webm' | 'wav';
  duration_seconds: number;
  file_size_bytes: number;
  recording_metadata?: {
    questions_answered: number;
    recording_date: string;
  };
}

export interface UploadResponse {
  recording_id: string;
  storage_path: string;
  public_url: string;
  status: 'pending' | 'complete' | 'failed';
  created_at: string;
}

// ============================================================================
// Processing Types
// ============================================================================

export type ProcessingStatus = 'pending' | 'in_progress' | 'complete' | 'failed' | 'recorded_and_uploaded';

export interface ProcessingStepResult {
  status: ProcessingStatus;
  progress?: number;
  error?: string;
  result?: Record<string, unknown>;
}

export interface ProcessingStatusResponse {
  user_id: string;
  overall_status: ProcessingStatus;
  steps: {
    transcription: ProcessingStepResult & {
      result?: {
        transcript: string;
        word_count: number;
      };
    };
    personality_analysis: ProcessingStepResult & {
      result?: {
        summary: string;
        traits: Record<string, number>;
      };
    };
    voice_cloning: ProcessingStepResult & {
      result?: {
        voice_clone_id: string;
        quality_score: number;
      };
    };
  };
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Family Types (matching Django schema exactly)
// ============================================================================

export type RelationshipType = 'spouse' | 'child' | 'parent' | 'sibling' | 'friend';

export interface FamilyMember {
  id: string;
  ai_owner: {
    id: string;
    full_name: string;
    email: string;
  };
  email: string;
  full_name: string | null;
  relationship: RelationshipType;
  has_access: boolean;
  invitation_sent_at: string;
  invitation_accepted_at: string | null;
  user_account: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  conversation_count: number;
  last_conversation_at: string | null;
}

export interface InviteRequest {
  email: string;
  full_name: string;
  relationship: RelationshipType;
  message?: string;
}

export interface InviteResponse {
  invitation_id: string;
  invitation_token: string;
  invitation_link: string;
  expires_at: string;
}

export interface AcceptInviteRequest {
  token: string;
  full_name?: string;
  password?: string; // If new user
}

export interface FamilyMemberListResponse {
  count: number;
  members: FamilyMember[];
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatRequest {
  ai_owner_id: string;
  family_member_id: string;
  message: string;
  context?: {
    conversation_id?: string;
    reference_memory?: string;
  };
}

export interface Conversation {
  id: string;
  ai_owner: {
    id: string;
    full_name: string;
  };
  family_member: {
    id: string;
    full_name: string;
  };
  question_text: string;
  response_text: string;
  audio_url?: string;
  user_rating?: number;
  user_feedback?: string;
  created_at: string;
  response_time_ms: number;
}

export type ChatStreamChunkType = 'token' | 'audio_url' | 'complete' | 'error';

export interface ChatStreamChunk {
  type: ChatStreamChunkType;
  data: string;
  conversation_id?: string;
  audio_task_id?: string;
}

// ============================================================================
// Store State Types
// ============================================================================

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type RecordingStatus = 'idle' | 'recording' | 'reviewing' | 'uploading' | 'complete';

export interface RecordingState {
  questions: Question[];
  currentIndex: number;
  recordings: Map<number, RecordingData>;
  isRecording: boolean;
  isPaused: boolean;
  currentDuration: number;
  uploadProgress: number;
  status: RecordingStatus;
}

export interface ChatState {
  aiOwnerId: string | null;
  familyMemberId: string | null;
  messages: Conversation[];
  currentMessage: string;
  isStreaming: boolean;
  streamingText: string[];
  audioQueue: string[];
  isAudioPlaying: boolean;
  error: string | null;
}

// ============================================================================
// Admin Types
// ============================================================================

export interface AdminStats {
  total_users: number;
  total_recordings: number;
  total_conversations: number;
  ai_ready_count: number;
  processing_count: number;
  failed_count: number;
  recent_signups: number;
  active_questions?: number;
  inactive_questions?: number;
  payments_total?: number;
  payments_succeeded?: number;
  payments_failed?: number;
  revenue_cents?: number;
  revenue_display?: string;
  pending_processing?: number;
  failed_processing?: number;
  api_usage: {
    openai_calls: number;
    elevenlabs_calls: number;
    total_cost: number;
  };
  recent_payments?: AdminPayment[];
  recent_failures?: AdminLogEntry[];
}

export interface AdminUser extends User {
  family_members_count: number;
  conversations_count: number;
  ai_processing_started_at: string | null;
  recordings: Array<{
    id: string;
    storage_path: string;
    duration_seconds: number;
    created_at: string;
  }>;
}

export interface AdminUserListResponse {
  count: number;
  results: AdminUser[];
}

export interface QuestionFormData {
  question_text: string;
  domain: QuestionDomain;
  order: number;
  tip?: string;
  suggested_duration_seconds: number;
  is_active: boolean;
}

export interface ReorderQuestionsRequest {
  questions: Array<{
    id: string;
    order: number;
  }>;
}

export interface AdminProcessingJob {
  user_id: string;
  user_name: string;
  user_email: string;
  status: ProcessingStatus;
  steps: ProcessingStatusResponse['steps'];
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export type AdminPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface AdminPayment {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  stripe_payment_intent_id: string;
  stripe_customer_id: string;
  amount_cents: number;
  amount_display: string;
  currency: string;
  status: AdminPaymentStatus;
  package_tier: 'free' | 'premium';
  payment_type: 'one_time';
  payment_method: string | null;
  receipt_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLogEntry {
  id: string;
  source: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  user_id: string | null;
  user_email: string | null;
  context: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}
