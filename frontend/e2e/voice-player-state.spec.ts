import { expect, test } from '@playwright/test';
import type { Conversation } from '../src/types';

// Node tests of media events and store state; no browser or paid API is used.
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static nextPlayError: Error | null = null;
  src = '';
  preload = '';
  volume = 1;
  currentTime = 0;
  duration = Number.NaN;
  ended = false;
  paused = true;
  error = null;
  playCalls = 0;
  constructor() { super(); FakeAudio.instances.push(this); }
  load() { this.currentTime = 0; this.ended = false; }
  removeAttribute(name: string) { if (name === 'src') this.src = ''; }
  play(): Promise<void> {
    this.playCalls++;
    const error = FakeAudio.nextPlayError;
    FakeAudio.nextPlayError = null;
    if (error) return Promise.reject(error);
    this.paused = false;
    this.ended = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
}

let useChatStore: typeof import('../src/store/chat')['useChatStore'];
let chatApi: typeof import('../src/lib/api/chat')['chatApi'];
const originals = new Map<string, PropertyDescriptor | undefined>();

test.beforeAll(async () => {
  const memory = new Map<string, string>();
  const globals = {
    window: {}, Audio: FakeAudio,
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  // Load the modules after installing the media globals in this Node test worker.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  useChatStore = require('../src/store/chat').useChatStore;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  chatApi = require('../src/lib/api/chat').chatApi;
});

test.afterAll(() => {
  useChatStore?.getState().reset();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test.beforeEach(() => {
  useChatStore.getState().reset();
  FakeAudio.instances = [];
  FakeAudio.nextPlayError = null;
});

test('a saved reply plays after a fresh load, reports metadata, pauses, seeks and replays', () => {
  expect(useChatStore.getState().voicePlayer).toBeNull();
  useChatStore.getState().playAudio('/saved-reply.wav', 'saved');
  const audio = FakeAudio.instances[0];
  expect(audio.src).toBe('/saved-reply.wav');
  expect(useChatStore.getState().isAudioPlaying).toBe(true);
  audio.duration = 15.36;
  audio.dispatchEvent(new Event('loadedmetadata'));
  expect(useChatStore.getState().duration).toBe(15.36);
  useChatStore.getState().pauseAudio();
  expect(useChatStore.getState().isAudioPlaying).toBe(false);
  useChatStore.getState().seekAudio(5);
  expect(audio.currentTime).toBe(5);
  useChatStore.getState().resumeAudio();
  expect(useChatStore.getState().isAudioPlaying).toBe(true);
  audio.ended = true;
  audio.currentTime = 15.36;
  audio.dispatchEvent(new Event('timeupdate'));
  audio.dispatchEvent(new Event('ended'));
  expect(useChatStore.getState().isAudioPlaying).toBe(false);
  expect(useChatStore.getState().duration).toBe(15.36);
  useChatStore.getState().resumeAudio();
  expect(audio.currentTime).toBe(0);
  expect(useChatStore.getState().isAudioPlaying).toBe(true);
});

test('blocked autoplay keeps duration and offers a working manual retry without duplicate playback', async () => {
  const blocked = new Error('User gesture required');
  blocked.name = 'NotAllowedError';
  FakeAudio.nextPlayError = blocked;
  useChatStore.getState().queueAudio('/reply.wav', 'reply');
  const audio = FakeAudio.instances[0];
  audio.duration = 12;
  audio.dispatchEvent(new Event('loadedmetadata'));
  await Promise.resolve();
  expect(useChatStore.getState().isAudioPlaying).toBe(false);
  expect(useChatStore.getState().audioErrors.reply).toContain('Tap Play');
  expect(useChatStore.getState().duration).toBe(12);
  useChatStore.getState().queueAudio('/reply.wav', 'reply');
  expect(audio.playCalls).toBe(1);
  useChatStore.getState().playAudio('/reply.wav', 'reply');
  expect(audio.playCalls).toBe(2);
  expect(useChatStore.getState().isAudioPlaying).toBe(true);
  expect(useChatStore.getState().audioErrors.reply).toBe('');
});

test('audio discovered by history refresh is queued even before the next poll', async () => {
  useChatStore.setState({ conversations: [{ id: 'ready', audio_url: '/ready.wav' } as Conversation] });
  await useChatStore.getState().pollAudioStatus('task', 'ready');
  expect(FakeAudio.instances[0].src).toBe('/ready.wav');
  expect(useChatStore.getState().processingAudioIds).toEqual([]);
  expect(useChatStore.getState().currentAudioId).toBe('ready');
});

test('audio arriving before the final text event survives the optimistic conversation update', async () => {
  const originalStream = chatApi.sendMessageStream;
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (() => 0) as unknown as typeof setTimeout;
  chatApi.sendMessageStream = (_params, onToken, onAudioUrl, _onTask, onComplete) => {
    onToken('Hello');
    onAudioUrl('/fast-reply.wav', 'fast');
    onComplete('fast');
    return { close() {} };
  };
  try {
    useChatStore.setState({ aiOwnerId: 'owner', familyMemberId: 'family' });
    await useChatStore.getState().sendMessage('Hi');
    expect(useChatStore.getState().conversations[0].audio_url).toBe('/fast-reply.wav');
    expect(useChatStore.getState().conversations[0].response_text).toBe('Hello');
  } finally {
    chatApi.sendMessageStream = originalStream;
    globalThis.setTimeout = originalTimeout;
  }
});
