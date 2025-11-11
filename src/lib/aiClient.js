import AI_SETTINGS, { FRACTAL_DIRECTIVE_SCHEMA } from '../config/aiSettings.js';

const SETTINGS = AI_SETTINGS;

const DEFAULT_SYSTEM_PROMPT = `
You are an AI curator orchestrating an evolving fractal visual experience.
You receive the current fractal state along with recent history.
Respond with JSON that matches the provided schema to keep the visuals novel but cohesive.
Prefer gentle evolutions over abrupt changes unless the scene has been static for several cycles.
Avoid repeating recent palettes and variants when possible, and maintain comfortable zoom ranges.
`.trim();

export class AiClientError extends Error {
  constructor(message, { cause, code } = {}) {
    super(message);
    this.name = 'AiClientError';
    this.cause = cause;
    this.code = code;
  }
}

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const encodeMessages = ({ currentState, recentHistory }) => {
  const sanitizedHistory = Array.isArray(recentHistory)
    ? recentHistory.slice(-SETTINGS.historyLimit)
    : [];
  return [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: DEFAULT_SYSTEM_PROMPT,
        },
        {
          type: 'input_text',
          text: JSON.stringify(FRACTAL_DIRECTIVE_SCHEMA),
          annotations: [{ type: 'json_schema', schema: FRACTAL_DIRECTIVE_SCHEMA }],
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            currentState,
            recentHistory: sanitizedHistory,
          }),
        },
      ],
    },
  ];
};

const withTimeout = async (promise, timeoutMs, signal) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const cleanup = () => clearTimeout(timeoutId);

  if (signal) {
    if (signal.aborted) {
      cleanup();
      controller.abort();
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await promise(controller.signal);
  } finally {
    cleanup();
  }
};

const parseStructuredResponse = async (response) => {
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new AiClientError('Failed to parse AI response JSON', { cause: error, code: 'PARSE_ERROR' });
  }

  if (!payload) {
    throw new AiClientError('AI response payload was empty', { code: 'EMPTY_RESPONSE' });
  }

  const delta = payload?.output?.[0]?.content?.find?.((item) => item.type === 'output_json');
  if (delta?.json) {
    return delta.json;
  }

  if (typeof payload === 'object' && !Array.isArray(payload)) {
    return payload;
  }

  throw new AiClientError('AI response was missing structured content', { code: 'MISSING_JSON' });
};

export const createAiClient = ({
  apiKey = SETTINGS.apiKey,
  baseUrl = SETTINGS.baseUrl,
  model = SETTINGS.model,
  maxRetries = SETTINGS.maxRetries,
  requestTimeoutMs = SETTINGS.requestTimeoutMs,
  maxTokens = SETTINGS.maxTokens,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  log = SETTINGS.enableLogging ? console.info : null,
} = {}) => {
  if (!fetchImpl) {
    throw new AiClientError('No fetch implementation available', { code: 'FETCH_UNAVAILABLE' });
  }

  const endpoint =
    SETTINGS.provider === 'openai' ? `${baseUrl.replace(/\/+$/, '')}/responses` : `${baseUrl}/chat/completions`;

  const invoke = async ({ currentState, recentHistory = [] }, attempt = 0, externalSignal) => {
    if (!apiKey) {
      throw new AiClientError('Missing AI API key', { code: 'NO_API_KEY' });
    }

    const payload = {
      model,
      max_output_tokens: maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'fractal_directive',
          schema: FRACTAL_DIRECTIVE_SCHEMA,
        },
      },
      input: encodeMessages({ currentState, recentHistory }),
    };

    if (log) {
      log('[AI] Requesting directive', {
        attempt,
        provider: SETTINGS.provider,
        hasHistory: recentHistory?.length > 0,
      });
    }

    const executeFetch = (signal) =>
      fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify(payload),
      });

    try {
      const response = await withTimeout(executeFetch, requestTimeoutMs, externalSignal);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new AiClientError('AI request failed', {
          code: response.status,
          cause: errorText,
        });
      }
      return await parseStructuredResponse(response);
    } catch (error) {
      if (
        attempt < maxRetries &&
        (error.code === 'PARSE_ERROR' ||
          error.code === 'MISSING_JSON' ||
          error.code === 'EMPTY_RESPONSE' ||
          error.name === 'AbortError')
      ) {
        const backoffMs = Math.min(1500 * (attempt + 1), 4000);
        if (log) {
          log('[AI] Retrying directive request after failure', {
            attempt,
            backoffMs,
            error: error.message,
          });
        }
        await sleep(backoffMs);
        return invoke({ currentState, recentHistory }, attempt + 1, externalSignal);
      }
      throw error instanceof AiClientError ? error : new AiClientError(error.message, { cause: error });
    }
  };

  return {
    requestDirective: invoke,
    settings: () => ({
      provider: SETTINGS.provider,
      model,
      baseUrl,
      requestTimeoutMs,
      maxRetries,
      maxTokens,
    }),
  };
};

const defaultClient = createAiClient();

export const requestFractalDirective = (context, options = {}) =>
  defaultClient.requestDirective(context, 0, options.signal);

export default defaultClient;

