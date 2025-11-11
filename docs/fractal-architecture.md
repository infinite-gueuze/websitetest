# Fractal Architecture Guide

## Overview

The application is split into three layers:

1. **Configuration & Utilities** – static presets and pure helpers used across the stack.
2. **Engine Layer** – the canvas + worker renderer with an imperative API.
3. **React Composition** – hooks that orchestrate behaviour and presentational components that render the UI.

The diagram below shows how data flows between the layers.

```
fractalSettings.js ──► useFractalControls ──► FractalExperience & children
        ▲                     │                         │
        │                     ▼                         │
  utils/* (math, color)   useFractalEngine ───────────► fractalEngine.js ──► workers/fractalWorker.js
```

## Configuration

- `src/config/fractalSettings.js` – owns palettes, variants, focus presets, and scene definitions. It exports immutable objects so tweaks remain predictable.
- `src/utils/math.js`, `src/utils/fractalColor.js`, `src/utils/fractalControls.js` – pure helpers with unit tests under `src/__tests__`.

### Adding Presets

1. Append a new scene to `SCENE_DEFINITIONS` with a unique `name`, target scale range, zoom speed range, and palette/variant biases.
2. (Optional) Provide additional focus locations in `FOCUS_PRESETS` if a preset needs custom snap points.
3. The Presets picker will automatically include the new entry; the label is derived from the `name`.

## Engine Layer

- `src/lib/fractalEngine.js`
  - Initialises a worker, resizes the canvas for device pixel ratio, and coordinates render messages.
  - `updateSettings` accepts partial config updates (render interval, DPR, callbacks) without recreating the engine.
  - `setPalette` streams Float32 color buffers to the worker.
  - Telemetry (`fps`, `frameTimeMs`, `totalFrames`) is averaged and emitted every frame via the optional `onTelemetry` callback.
- `src/hooks/useFractalEngine.js`
  - Creates the engine once per canvas ref.
  - Stores the latest render/telemetry callbacks in refs and syncs them with `updateSettings`.
  - Reacts to palette changes and config updates (render interval, DPR) without tearing down the engine.

### Rendering Worker

`src/workers/fractalWorker.js` receives the render payload from the engine, computes the fractal, and returns an `ArrayBuffer` containing pixels. The worker is unchanged by this refactor but now benefits from debounced engine updates.

## Control Layer

- `src/hooks/useFractalControls.js`
  - Exposes state for fractal type, palette index, auto zoom speed/direction, mutations, fullscreen, and the active preset.
  - Manages cooldown timers and mutation scheduling via `requestAnimationFrame`.
  - Uses the configuration layer to select new focus targets, Julia seeds, palettes, and presets.
  - Returns memoised handler functions grouped under `handlers`.
  - Supplies `presetOptions` and `activePreset` for the Preset selector UI.
- `src/components/fractal/`
  - `FractalCanvas` – canvas surface plus gradient overlays.
  - `FractalHeader` – hero copy and title.
  - `FractalControlPanel` – all interactive controls. Delegates to shared UI primitives in `src/components/ui/`.
  - `PresetSelector` – renders preset buttons, highlighting the active preset.
  - `StatusAnnouncer` – SR-friendly aria live region for status updates.

## Shared UI

Located in `src/components/ui/`:

- `Button.jsx` – focusable, variant-based button with consistent typography and hover treatments.
- `Toggle.jsx` – wrapper around `Button` adding `aria-pressed` state styling.
- `Slider.jsx` – stylised range input for the auto zoom control.

Extend these primitives when introducing new controls to maintain consistency.

## Styling

- Tailwind utilities handle layout and spacing.
- Custom gradients and glow backgrounds live in `src/styles/fractal.css`.
- Animations are defined in `src/App.css` (`animate-glow-orbit`, `animate-float-gradient`).

## Testing

- Unit tests cover utilities (`math`, `fractalColor`, `fractalControls`), the engine, and the custom hooks (`useFractalEngine`, `useFractalControls`).
- When adding new behaviour to the hook or engine, prefer adding Vitest coverage to prevent regressions in the render loop or preset logic.

## Performance Workflow

1. Run `npm run perf:fractal -- --preset=<name>` after implementing or tuning the engine to gather raw frame timings.
2. Capture Chrome performance traces for each preset and append results to `docs/performance-baseline.md`.
3. Compare telemetry from `useFractalEngine` (exposed through future UI hooks) when tweaking animation cadence or device pixel ratio caps.


