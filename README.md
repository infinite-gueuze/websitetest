# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Manual Test Results

Desktop (Chrome 119) and simulated touch input (Chrome DevTools device toolbar) were used to verify the fractal explorer controls after the performance and UX updates.

- Randomize Colors — PASS (desktop click & touch tap)
- Switch Mandelbrot/Julia — PASS (desktop & touch)
- Shuffle Everything — PASS (desktop & touch)
- Zoom In / Zoom Out — PASS (desktop & touch)
- New Julia Seed (Julia mode only) — PASS (desktop & touch)
- Auto Zoom Speed slider — PASS (keyboard, pointer drag, touch drag)
- Reverse Flow toggle — PASS (desktop & touch)
- Pointer hover/touch focus warp — PASS (desktop hover, touch drag)
