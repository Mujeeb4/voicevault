const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

/** Exercise the production TypeScript modules without adding another test runtime. */
function createRuntime(overrides = {}, globals = {}) {
  const modules = new Map();
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const context = vm.createContext({
    console, Date, atob, btoa, Event, AbortController, TextDecoder, URLSearchParams,
    Blob, FormData, localStorage, window: { dispatchEvent() {} }, ...globals,
  });
  function load(relative) {
    const filename = path.resolve(__dirname, '../src', relative);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const requireModule = (id) => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith('@/')) return load(`${id.slice(2)}.ts`);
      if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(filename), `${id}.ts`)));
      return require(id);
    };
    vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(requireModule, module, module.exports);
    return module.exports;
  }
  return { load };
}

const jwt = (seconds = 3600) => `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.sig`;
const response = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} });

function apiRuntime(adapter) {
  const isolatedAxios = axios.create({ adapter });
  // Share only this test's transport with both the refresh client and authenticated client.
  isolatedAxios.isAxiosError = axios.isAxiosError;
  isolatedAxios.create = (config) => axios.create({ ...config, adapter });
  const runtime = createRuntime({ axios: isolatedAxios });
  const session = runtime.load('lib/auth/session.ts');
  const client = runtime.load('lib/api/client.ts');
  return { session, ...client };
}

test('concurrent expired-token requests share one refresh and retain rotated refresh token', async () => {
  let refreshes = 0;
  const freshAccess = jwt();
  const { session, default: client } = apiRuntime(async (config) => {
    if (config.url.endsWith('/users/refresh/')) {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(config, { access: freshAccess, refresh: 'rotated-refresh' });
    }
    assert.equal(config.headers.Authorization, `Bearer ${freshAccess}`);
    return response(config, { id: 'user' });
  });
  session.setTokens({ access: jwt(-30), refresh: 'original-refresh' });
  await Promise.all([client.get('/users/profile/'), client.get('/family/members/')]);
  assert.equal(refreshes, 1);
  assert.equal(session.getRefreshToken(), 'rotated-refresh');
});

test('401 retries once after refresh; rejected refresh clears the session', async () => {
  let profileCalls = 0;
  let refreshCalls = 0;
  const runtime = apiRuntime(async (config) => {
    if (config.url.endsWith('/users/refresh/')) {
      refreshCalls += 1;
      return response(config, { access: jwt(), refresh: 'renewed' });
    }
    profileCalls += 1;
    if (profileCalls === 1) throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response(config, {}, 401));
    return response(config, { id: 'user' });
  });
  runtime.session.setTokens({ access: jwt(), refresh: 'refresh' });
  await runtime.default.get('/users/profile/');
  assert.equal(profileCalls, 2);
  assert.equal(refreshCalls, 1);

  const rejected = apiRuntime(async (config) => {
    throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response(config, {}, 401));
  });
  rejected.session.setTokens({ access: jwt(-30), refresh: 'invalid' });
  await assert.rejects(rejected.default.get('/users/profile/'));
  assert.equal(rejected.session.getAccessToken(), null);
  assert.equal(rejected.session.getRefreshToken(), null);
});

test('invalid login leaves an existing session intact and never attempts refresh', async () => {
  let calls = 0;
  const runtime = apiRuntime(async (config) => {
    calls += 1;
    assert.equal(config.headers.Authorization, undefined);
    throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, response(config, {}, 401));
  });
  runtime.session.setTokens({ access: jwt(), refresh: 'refresh' });
  await assert.rejects(runtime.default.post('/users/login/', { email: 'test@example.com', password: 'wrong' }));
  assert.equal(calls, 1);
  assert.equal(runtime.session.getRefreshToken(), 'refresh');
});

function chatRuntime(fetch) {
  const runtime = createRuntime({
    './client': {
      __esModule: true, default: {}, API_BASE_URL: '/api',
      getValidAccessToken: async () => 'access', refreshAccessToken: async () => 'renewed',
    },
    '@/lib/auth/session': { getRefreshToken: () => 'refresh', clearTokens() {} },
  }, { fetch });
  return runtime.load('lib/api/chat.ts').chatApi;
}

async function streamResult(api) {
  const tokens = [];
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Stream failed to reach a terminal state')), 1000);
    const finish = (value) => { clearTimeout(timeout); resolve({ tokens, ...value }); };
    api.sendMessageStream({ ai_owner_id: 'owner', family_member_id: 'member', message: 'Hello' },
      (token) => tokens.push(token), () => {}, () => {},
      (id) => finish({ id }), (error) => finish({ error }));
  });
}

test('chat sends same-origin bearer-authenticated POST and parses fragmented SSE including final event at EOF', async () => {
  const encoder = new TextEncoder();
  const api = chatRuntime(async (url, options) => {
    assert.equal(url, '/api/chat/stream/');
    assert.equal(options.headers.Authorization, 'Bearer access');
    assert.deepEqual(JSON.parse(options.body), { ai_owner_id: 'owner', question: 'Hello' });
    return new Response(new ReadableStream({ start(controller) {
      for (const chunk of ['data: {"type":"text_ch', 'unk","content":"Hi"}\r\n\r\n', 'data: {"type":"complete","conversation_id":"conversation"}']) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const result = await streamResult(api);
  assert.equal(result.id, 'conversation');
  assert.deepEqual(result.tokens, ['Hi']);
});

test('chat shows Django quota errors and interrupted streams reach an error state', async () => {
  const denied = await streamResult(chatRuntime(async () => new Response(JSON.stringify({ message: 'Monthly message limit reached' }), { status: 402 })));
  assert.equal(denied.error, 'Monthly message limit reached');
  const interrupted = await streamResult(chatRuntime(async () => new Response('data: {"type":"text_chunk","content":"Partial"}\n\n')));
  assert.match(interrupted.error, /closed before/);
  assert.deepEqual(interrupted.tokens, ['Partial']);
});

test('combined recording uploads normalize backend status and multipart metadata', async () => {
  const runtime = createRuntime({ './client': { __esModule: true, default: { post: async (url, form) => {
    assert.equal(url, '/recordings/upload/');
    const metadata = JSON.parse(form.get('recording_metadata'));
    assert.equal(metadata.is_final_chunk, true);
    assert.equal(metadata.total_duration_seconds, 120);
    return { data: { recording_id: 'recording', status: 'complete' } };
  } } } });
  const api = runtime.load('lib/api/recordings.ts').recordingsApi;
  const result = await api.uploadRecording(new Blob(['audio']), { file_format: 'webm', duration_seconds: 120, file_size_bytes: 5 });
  assert.equal(result.recording_id, 'recording');
  assert.equal(result.status, 'complete');
});

test('voice transcription supplies the audio format in the uploaded filename', async () => {
  const runtime = createRuntime({ './client': { __esModule: true, default: { post: async (url, form) => {
    assert.equal(url, '/chat/transcribe-voice/');
    assert.equal(form.get('audio').name, 'voice-input.m4a');
    return { data: { transcript: 'A memory' } };
  } } } });
  const result = await runtime.load('lib/api/chat.ts').chatApi.transcribeVoice(new Blob(['audio'], { type: 'audio/mp4' }));
  assert.equal(result.transcript, 'A memory');
});

test('invitation acceptance consumes the token once without sending credentials and routes to the invited AI', async () => {
  let calls = 0;
  const runtime = createRuntime({ './client': { __esModule: true, default: { post: async (url, body) => {
    calls += 1;
    assert.equal(url, '/family/accept-invite/invitation-token/');
    assert.deepEqual(Object.keys(body), []);
    return { data: { message: 'Accepted', ai_owner: { id: 'owner' } } };
  } } } });
  const result = await runtime.load('lib/api/family.ts').familyApi.acceptInvitation('invitation-token');
  assert.equal(calls, 1);
  assert.equal(result.redirect_url, '/chat/owner');
});

test('post-auth redirects reject absolute, protocol-relative, backslash, and control-character URLs', () => {
  const { safeRedirectPath } = createRuntime().load('lib/utils.ts');
  for (const unsafe of ['https://elsewhere.example', '//elsewhere.example', '/\\elsewhere.example', '/\n/elsewhere.example']) {
    assert.equal(safeRedirectPath(unsafe, '/dashboard'), '/dashboard');
  }
  assert.equal(safeRedirectPath('/chat/owner?from=invite', '/dashboard'), '/chat/owner?from=invite');
});
