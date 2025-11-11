# Fractal Performance Baseline

Use this log to track render performance before and after refactors. Update the table whenever presets, shaders, or engine logic change.

| Date | Commit / Branch | Preset | Avg FPS | Min FPS | Max FPS | Notes |
|------|-----------------|--------|---------|---------|---------|-------|
| 2025-11-11 | refactor/modular-engine | deep-dive | _pending_ | _pending_ | _pending_ | New modular architecture landed – record baseline trace post-merge. |
| 2025-11-11 | refactor/modular-engine | breathing-bloom | _pending_ | _pending_ | _pending_ | Capture CPU/GPU stats alongside FPS sample. |
| 2025-11-11 | refactor/modular-engine | cosmic-orbit | _pending_ | _pending_ | _pending_ | Verify preset transitions and stutter-free playback. |

## Profiling Checklist

- [ ] Run `npm run perf:fractal -- --preset=<name>` after the engine shim lands to gather automated metrics.
- [ ] Store browser performance traces in `docs/perf-traces/` (create if missing).
- [ ] Document environment details (device, browser version, screen resolution).
- [ ] Compare post-refactor numbers against the initial baseline.

