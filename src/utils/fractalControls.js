import {
  FRACTAL_CONSTANTS,
  FOCUS_PRESETS,
  SCENE_DEFINITIONS,
} from '../config/fractalSettings.js';
import { clamp, pickFrom } from './math.js';

const {
  AUTO_ZOOM_MIN_PERCENT,
  AUTO_ZOOM_MAX_PERCENT,
  AUTO_ZOOM_MIN_SPEED,
  AUTO_ZOOM_MAX_SPEED,
} = FRACTAL_CONSTANTS;

/**
 * Pick a random scene definition, optionally excluding the current name.
 * @param {string|null|undefined} excludeName
 * @param {typeof SCENE_DEFINITIONS} [scenes=SCENE_DEFINITIONS]
 * @param {() => number} [rng=Math.random]
 */
export function pickSceneDefinition(excludeName, scenes = SCENE_DEFINITIONS, rng = Math.random) {
  const options = excludeName ? scenes.filter((scene) => scene.name !== excludeName) : scenes;
  return pickFrom(options, rng);
}

/**
 * Choose a focus target based on fractal type, variant, and scale.
 * @param {'mandelbrot'|'julia'} fractalType
 * @param {string} variant
 * @param {number} targetScale
 * @param {typeof FOCUS_PRESETS} [focusPresets=FOCUS_PRESETS]
 * @param {() => number} [rng=Math.random]
 */
export function pickFocusTarget(
  fractalType,
  variant,
  targetScale,
  focusPresets = FOCUS_PRESETS,
  rng = Math.random,
) {
  const variantKey = variant || 'classic';
  const typePresets = focusPresets[fractalType];
  if (!typePresets) {
    return null;
  }
  const presetList = typePresets[variantKey] || typePresets.classic;
  if (!presetList || !presetList.length) {
    return null;
  }
  const sorted = [...presetList].sort((a, b) => a.scale - b.scale);
  for (let i = 0; i < sorted.length; i += 1) {
    const preset = sorted[i];
    if (targetScale <= preset.scale * 1.1) {
      const jitter = preset.scale * 0.18;
      return {
        x: preset.center.x + (rng() - 0.5) * jitter,
        y: preset.center.y + (rng() - 0.5) * jitter,
      };
    }
  }
  const fallback = sorted[sorted.length - 1];
  const jitter = fallback.scale * 0.2;
  return {
    x: fallback.center.x + (rng() - 0.5) * jitter,
    y: fallback.center.y + (rng() - 0.5) * jitter,
  };
}

/**
 * Generate a random Julia seed coordinate.
 * @param {() => number} [rng=Math.random]
 * @returns {{ x: number; y: number }}
 */
export function randomJuliaSeed(rng = Math.random) {
  const angle = rng() * Math.PI * 2;
  const radius = 0.6 + rng() * 0.35;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/**
 * Convert an auto zoom speed to a percentage (for UI sliders).
 * @param {number} speed
 * @returns {number}
 */
export function autoZoomSpeedToPercent(speed) {
  const clamped = clamp(speed, AUTO_ZOOM_MIN_SPEED, AUTO_ZOOM_MAX_SPEED);
  const ratio = (clamped - AUTO_ZOOM_MIN_SPEED) / (AUTO_ZOOM_MAX_SPEED - AUTO_ZOOM_MIN_SPEED);
  return ratio * (AUTO_ZOOM_MAX_PERCENT - AUTO_ZOOM_MIN_PERCENT) + AUTO_ZOOM_MIN_PERCENT;
}

/**
 * Convert an auto zoom percentage back to the engine speed value.
 * @param {number} percent
 * @returns {number}
 */
export function percentToAutoZoomSpeed(percent) {
  const clamped = clamp(percent, AUTO_ZOOM_MIN_PERCENT, AUTO_ZOOM_MAX_PERCENT);
  const ratio = (clamped - AUTO_ZOOM_MIN_PERCENT) / (AUTO_ZOOM_MAX_PERCENT - AUTO_ZOOM_MIN_PERCENT);
  return AUTO_ZOOM_MIN_SPEED + ratio * (AUTO_ZOOM_MAX_SPEED - AUTO_ZOOM_MIN_SPEED);
}

/**
 * Format a fractal variant into a label for the UI.
 * @param {string} variant
 * @returns {string}
 */
export function formatVariantLabel(variant) {
  if (!variant || variant === 'classic') {
    return 'classic';
  }
  return variant.replace(/-/g, ' ');
}

