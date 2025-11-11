const inferBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return fallback;
};

const getEnv = (key) => {
  const env = import.meta?.env ?? {};
  return env[key];
};

const AI_PROVIDER = getEnv('VITE_AI_PROVIDER') || 'openai';
const API_BASE_URL =
  getEnv('VITE_AI_API_BASE_URL') || (AI_PROVIDER === 'openai' ? 'https://api.openai.com/v1' : '');
const API_KEY = getEnv('VITE_AI_API_KEY') || getEnv('VITE_OPENAI_API_KEY') || '';
const MODEL_NAME = getEnv('VITE_AI_MODEL') || getEnv('VITE_OPENAI_MODEL') || 'gpt-4.1-mini';

const SUGGESTION_INTERVAL_MS = Number.parseInt(getEnv('VITE_AI_SUGGESTION_INTERVAL_MS'), 10);
const HISTORY_LIMIT = Number.parseInt(getEnv('VITE_AI_HISTORY_LIMIT'), 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(getEnv('VITE_AI_REQUEST_TIMEOUT_MS'), 10);
const MAX_RETRIES = Number.parseInt(getEnv('VITE_AI_MAX_RETRIES'), 10);

export const AI_SETTINGS = Object.freeze({
  provider: AI_PROVIDER,
  apiKey: API_KEY,
  baseUrl: API_BASE_URL,
  model: MODEL_NAME,
  enableLogging: inferBoolean(getEnv('VITE_AI_LOGGING'), false),
  suggestionIntervalMs: Number.isFinite(SUGGESTION_INTERVAL_MS) ? SUGGESTION_INTERVAL_MS : 45_000,
  historyLimit: Number.isFinite(HISTORY_LIMIT) ? HISTORY_LIMIT : 6,
  requestTimeoutMs: Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 12_000,
  maxRetries: Number.isFinite(MAX_RETRIES) ? MAX_RETRIES : 2,
  maxTokens: 800,
});

export const FRACTAL_DIRECTIVE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    variant: { type: 'string', enum: ['classic', 'cubic', 'burning-ship', 'perpendicular'] },
    fractalType: { type: 'string', enum: ['mandelbrot', 'julia'] },
    paletteIndex: { type: 'integer', minimum: 0 },
    autoZoomPercent: { type: 'number', minimum: 1, maximum: 100 },
    autoZoomDirection: { type: 'integer', enum: [-1, 1] },
    mutationsEnabled: { type: 'boolean' },
    juliaSeed: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['x', 'y'],
    },
    preset: { type: 'string' },
    statusMessage: { type: 'string' },
    cadenceMs: { type: 'number', minimum: 15_000, maximum: 180_000 },
  },
  additionalProperties: false,
});

export default AI_SETTINGS;

