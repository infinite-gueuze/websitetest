# Fractal Experience

Immersive Mandelbrot and Julia set explorer built with React, Vite, and a modular fractal engine. The UI exposes real‑time controls for palettes, zoom behaviour, and curated scene presets while the engine keeps rendering work off the main thread.

## Getting Started

```bash
npm install          # install dependencies
npm run dev          # start the local dev server
npm run build        # create a production build
npm run preview      # serve the production build locally
```

### AI Integration Setup

- Copy `env.example` to `.env.local` (or `.env`) and fill in the AI credentials:
  ```bash
  cp env.example .env.local
  ```
- Set `VITE_AI_API_KEY` to your service account key and adjust the model or provider if you are not using OpenAI.
- Restart the dev server after updating environment variables so Vite picks up the new configuration.

## Quality & Tooling

- `npm run lint` – ESLint with the project rules
- `npm run test` – Vitest unit tests (hooks, utilities, engine)
- `npm run perf:fractal` – lightweight CLI harness for profiling presets once the engine is available in Node (see script output for manual steps)

## Architecture Highlights

- `src/hooks/useFractalControls.js` orchestrates UI state, ambient scene logic, preset sequencing, and exposes memoised handlers for the components.
- `src/hooks/useFractalEngine.js` owns the lifecycle of the rendering engine (canvas sizing, worker messages, telemetry feeds).
- `src/lib/fractalEngine.js` encapsulates the worker-backed rendering loop with a clean imperative API (`setPalette`, `updateSettings`, `applyPreset`, `destroy`).
- Presentation components live under `src/components/fractal/` while shared UI primitives stay in `src/components/ui/`.
- Configuration for palettes, variants, focus targets, and scene presets is centralised in `src/config/fractalSettings.js`.

An extended breakdown of the modules and data flow is available in `docs/fractal-architecture.md`.

## Customising the Visuals

- Adjust or add presets by editing `SCENE_DEFINITIONS` inside `src/config/fractalSettings.js`. New entries automatically surface in the Presets picker.
- Tailor palette options under `FRACTAL_PALETTES`; the LUT builder normalises luminance for consistent contrast.
- Common gradients and glows live in `src/styles/fractal.css` to keep component markup tidy.
- Reusable button/toggle variants are defined in `src/components/ui/Button.jsx` & `Toggle.jsx`; extend or create new variants there when tweaking the control panel.

## Performance Notes

Baseline metrics and future regression comparisons should be recorded in `docs/performance-baseline.md`. After large rendering changes, run the profiling harness or capture a Chrome performance trace per preset and append the results to the table.

