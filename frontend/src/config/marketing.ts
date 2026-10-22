/**
 * Real material for the landing page.
 *
 * These sections stay hidden in production until you fill them in, so the site
 * never shows fake proof. In development they show a placeholder so you can
 * see where the content will appear.
 */

export interface VoiceSampleConfig {
  /** Public path to a short clip, e.g. '/samples/voice-sample.mp3'. null = not set yet. */
  src: string | null;
  /** Who is speaking, shown under the player. */
  speaker: string;
  /** One line of context for the clip. */
  caption: string;
  /** What is said in the clip, shown as text for accessibility. */
  transcript: string;
}

export const voiceSample: VoiceSampleConfig = {
  src: null,
  speaker: 'Your name here',
  caption: 'A real VoiceVault recording, shared with permission.',
  transcript: 'Paste the words spoken in the clip here.',
};

export interface FamilyStory {
  quote: string;
  name: string;
  relation: string;
  /** Optional public path to a photo. */
  photo?: string;
}

/** Add only real, consented stories. Leave empty to hide the section. */
export const familyStories: FamilyStory[] = [];
