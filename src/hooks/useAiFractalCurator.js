import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AI_SETTINGS, { FRACTAL_DIRECTIVE_SCHEMA } from '../config/aiSettings.js';
import { FRACTAL_PALETTES, FRACTAL_VARIANTS } from '../config/fractalSettings.js';
import { createAiClient } from '../lib/aiClient.js';
import { clamp } from '../utils/math.js';

const DIRECTIVE_CADENCE_LIMITS = Object.freeze({ min: 15_000, max: 180_000 });

const normalizeCadence = (value, fallback = AI_SETTINGS.suggestionIntervalMs) => {
  const base = Number.isFinite(value) ? value : fallback;
  return clamp(Math.round(base), DIRECTIVE_CADENCE_LIMITS.min, DIRECTIVE_CADENCE_LIMITS.max);
};

const sanitizeDirective = (raw, baseState, { cadenceDefault }) => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const sanitized = {};

  if (raw.fractalType && ['mandelbrot', 'julia'].includes(raw.fractalType)) {
    sanitized.fractalType = raw.fractalType;
  }

  if (raw.variant && FRACTAL_VARIANTS.includes(raw.variant)) {
    sanitized.variant = raw.variant;
  }

  if (Number.isFinite(raw.paletteIndex)) {
    const paletteCount = FRACTAL_PALETTES.length;
    sanitized.paletteIndex = ((Math.round(raw.paletteIndex) % paletteCount) + paletteCount) % paletteCount;
  }

  if (
    raw.juliaSeed &&
    typeof raw.juliaSeed === 'object' &&
    Number.isFinite(raw.juliaSeed.x) &&
    Number.isFinite(raw.juliaSeed.y)
  ) {
    sanitized.juliaSeed = {
      x: raw.juliaSeed.x,
      y: raw.juliaSeed.y,
    };
  }

  if (raw.preset && typeof raw.preset === 'string') {
    sanitized.preset = raw.preset;
  }

  if (raw.statusMessage && typeof raw.statusMessage === 'string') {
    sanitized.statusMessage = raw.statusMessage;
  }

  const cadence = Number.isFinite(raw.cadenceMs) ? raw.cadenceMs : cadenceDefault;
  sanitized.cadenceMs = normalizeCadence(cadence, cadenceDefault);

  if (!Object.keys(sanitized).length) {
    return null;
  }

  if (!sanitized.fractalType && baseState?.fractalType) {
    sanitized.fractalType = baseState.fractalType;
  }

  return sanitized;
};

const generateFallbackDirective = (state, history, cadenceDefault) => {
  const historyPalettes = new Set(history.map((entry) => entry.paletteIndex).filter((index) => Number.isFinite(index)));
  let nextPalette = (state.paletteIndex ?? 0) + 1;
  const paletteCount = FRACTAL_PALETTES.length;
  for (let attempt = 0; attempt < paletteCount; attempt += 1) {
    const candidate = ((nextPalette + attempt) % paletteCount + paletteCount) % paletteCount;
    if (candidate !== state.paletteIndex && !historyPalettes.has(candidate)) {
      nextPalette = candidate;
      break;
    }
  }
  nextPalette = ((nextPalette % paletteCount) + paletteCount) % paletteCount;

  const variantOptions = FRACTAL_VARIANTS.filter((variant) => variant !== state.fractalVariant);
  const nextVariant =
    variantOptions[Math.floor(Math.random() * variantOptions.length)] || state.fractalVariant;

  return {
    source: 'fallback',
    directive: {
      fractalType: state.fractalType,
      variant: nextVariant,
      paletteIndex: nextPalette,
      statusMessage: 'Fallback: weaving fresh colors',
      cadenceMs: normalizeCadence(cadenceDefault),
    },
  };
};

const defaultAiClient = createAiClient();

export function useAiFractalCurator({
  isEnabled = false,
  currentState,
  aiClient = defaultAiClient,
  autoCadenceMs = AI_SETTINGS.suggestionIntervalMs,
  fallbackGenerator = generateFallbackDirective,
} = {}) {
  const stateRef = useRef(currentState);
  const historyRef = useRef([]);
  const cadenceRef = useRef(normalizeCadence(autoCadenceMs));
  const timeoutRef = useRef(null);
  const abortRef = useRef(null);

  const [lastDirective, setLastDirective] = useState(null);
  const [lastSource, setLastSource] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    stateRef.current = currentState;
  }, [currentState]);

  const cadenceMs = useMemo(() => cadenceRef.current, [lastDirective]);

  const clearScheduledRequest = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cleanupAbort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const requestSuggestion = useCallback(
    async (options = {}) => {
      const state = stateRef.current;
      if (!state) {
        return null;
      }

      cleanupAbort();
      const controller = new AbortController();
      abortRef.current = controller;

      const history = historyRef.current.slice(-AI_SETTINGS.historyLimit);
      const cadenceDefault = normalizeCadence(cadenceRef.current, autoCadenceMs);
      const payload = {
        currentState: state,
        recentHistory: history,
      };

      setIsLoading(true);
      setError(null);

      try {
        const rawDirective = await aiClient.requestDirective(payload, 0, controller.signal);
        const sanitized = sanitizeDirective(rawDirective, state, { cadenceDefault });
        if (!sanitized) {
          throw new Error('AI response did not include actionable fields');
        }

        historyRef.current = [...history, { ...state, timestamp: Date.now() }].slice(
          -AI_SETTINGS.historyLimit,
        );
        cadenceRef.current = normalizeCadence(sanitized.cadenceMs, cadenceDefault);
        setLastDirective(sanitized);
        setLastSource('ai');
        setLastUpdatedAt(Date.now());
        return { directive: sanitized, source: 'ai' };
      } catch (err) {
        const fallback = fallbackGenerator(state, history, cadenceDefault);
        cadenceRef.current = normalizeCadence(fallback.directive.cadenceMs, cadenceDefault);
        setError(err);
        setLastDirective(fallback.directive);
        setLastSource(fallback.source);
        setLastUpdatedAt(Date.now());
        return fallback;
      } finally {
        setIsLoading(false);
        abortRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        if (options.reschedule !== false && (options.forceSchedule || isEnabled)) {
          const delay = normalizeCadence(
            options.delayOverride ?? cadenceRef.current ?? autoCadenceMs,
            autoCadenceMs,
          );
          timeoutRef.current = setTimeout(() => {
            requestSuggestion({ forceSchedule: true });
          }, delay);
        }
      }
    },
    [aiClient, autoCadenceMs, fallbackGenerator, cleanupAbort, isEnabled],
  );

  useEffect(() => {
    if (!isEnabled) {
      clearScheduledRequest();
      cleanupAbort();
      return undefined;
    }

    clearScheduledRequest();
    const initialDelay = normalizeCadence(cadenceRef.current, autoCadenceMs);
    timeoutRef.current = setTimeout(() => {
      requestSuggestion({ forceSchedule: true, delayOverride: initialDelay });
    }, 250);

    return () => {
      clearScheduledRequest();
      cleanupAbort();
    };
  }, [autoCadenceMs, clearScheduledRequest, cleanupAbort, isEnabled, requestSuggestion]);

  useEffect(
    () => () => {
      clearScheduledRequest();
      cleanupAbort();
    },
    [clearScheduledRequest, cleanupAbort],
  );

  const cancel = useCallback(() => {
    clearScheduledRequest();
    cleanupAbort();
  }, [clearScheduledRequest, cleanupAbort]);

  return {
    isEnabled,
    isLoading,
    error,
    cadenceMs,
    lastDirective,
    lastSource,
    lastUpdatedAt,
    requestSuggestion,
    cancel,
    schema: FRACTAL_DIRECTIVE_SCHEMA,
    history: historyRef.current,
  };
}

export default useAiFractalCurator;