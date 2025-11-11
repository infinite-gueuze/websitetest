/**
 * Linear interpolation between two numbers.
 * @param {number} a
 * @param {number} b
 * @param {number} t - Interpolation factor (0-1).
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value between a minimum and maximum.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Return a random number between min and max.
 * @param {number} min
 * @param {number} max
 * @param {() => number} [rng=Math.random]
 * @returns {number}
 */
export function randomRange(min, max, rng = Math.random) {
  return min + rng() * (max - min);
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {readonly T[]} array
 * @param {() => number} [rng=Math.random]
 * @returns {T}
 */
export function pickFrom(array, rng = Math.random) {
  if (!array.length) {
    throw new Error('Cannot pick from an empty array.');
  }
  const index = Math.floor(rng() * array.length);
  return array[index];
}

