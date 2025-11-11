#!/usr/bin/env node

/**
 * Simple profiling harness for the fractal renderer.
 *
 * The refactor will expose `createFractalEngine` that accepts a canvas-like
 * surface and options. Until that module exists we keep this script resilient
 * by shimming the interface and guiding contributors on how to record metrics.
 *
 * Usage:
 *   npm run perf:fractal -- --duration=5000 --preset=deep-dive
 *
 * The script will log frame statistics and recommended manual follow-up steps.
 */

import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);

async function loadEngine() {
  try {
    const { createFractalEngine } = await import('../src/lib/fractalEngine.js');
    return createFractalEngine;
  } catch (error) {
    console.warn(
      '[perf:fractal] Fractal engine not yet available. Once implemented, this script will execute the renderer directly.',
    );
    console.warn(`[perf:fractal] Details: ${error.message}`);
    return null;
  }
}

function parseArgs() {
  const defaults = {
    duration: 5000,
    preset: 'deep-dive',
  };

  const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    if (key.startsWith('--')) {
      const normalizedKey = key.slice(2);
      acc[normalizedKey] = value ?? true;
    }
    return acc;
  }, {});

  return {
    duration: Number(args.duration ?? defaults.duration),
    preset: args.preset ?? defaults.preset,
  };
}

async function main() {
  const createEngine = await loadEngine();
  const options = parseArgs();

  if (!createEngine) {
    console.log('\nTo capture baseline metrics:');
    console.log('  1. Open the app in a Chromium browser.');
    console.log('  2. Start the Performance profiler for the chosen preset.');
    console.log('  3. Record FPS and CPU/GPU utilization for at least 10 seconds.');
    console.log('  4. Save the trace in docs/performance-baseline.md.');
    return;
  }

  const fakeCanvas = {
    width: 1920,
    height: 1080,
    getContext() {
      throw new Error('TODO: Provide a headless canvas implementation for node profiling.');
    },
  };

  let engine;
  try {
    engine = createEngine(fakeCanvas, { preset: options.preset });
  } catch (error) {
    if (/requestAnimationFrame/.test(error.message) || /cancelAnimationFrame/.test(error.message)) {
      console.warn(
        '[perf:fractal] Node does not provide requestAnimationFrame/cancelAnimationFrame. Add a simple polyfill to scripts/profile-fractal.mjs before createFractalEngine or run the browser tracing flow described above.',
      );
      return;
    }
    throw error;
  }
  const stats = [];
  const start = performance.now();

  while (performance.now() - start < options.duration) {
    const frameStart = performance.now();
    engine.renderFrame?.();
    const frameTime = performance.now() - frameStart;
    stats.push(frameTime);
  }

  engine.destroy?.();

  if (!stats.length) {
    console.log('No frames captured. Ensure renderFrame is implemented.');
    return;
  }

  const total = stats.reduce((acc, value) => acc + value, 0);
  const avg = total / stats.length;
  const min = Math.min(...stats);
  const max = Math.max(...stats);

  console.log(`Preset: ${options.preset}`);
  console.log(`Frames: ${stats.length}`);
  console.log(`Average frame time: ${avg.toFixed(2)}ms (~${(1000 / avg).toFixed(1)} FPS)`);
  console.log(`Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
  console.log('Record these numbers in docs/performance-baseline.md for comparison.');
}

main().catch((error) => {
  console.error('[perf:fractal] Unexpected error:', error);
  process.exitCode = 1;
});

