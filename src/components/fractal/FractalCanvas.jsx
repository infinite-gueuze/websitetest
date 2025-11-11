export default function FractalCanvas({ canvasRef, fractalType, isFullscreen }) {
  return (
    <div
      className={`group relative w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-950/80 shadow-inner ${
        isFullscreen ? 'h-full' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        className={`block w-full select-none rounded-3xl bg-slate-950/80 ${
          isFullscreen ? 'h-full' : '[aspect-ratio:3/2]'
        } transition-transform duration-700 ease-out group-hover:scale-[1.01]`}
        role="img"
        aria-label={`Animated ${fractalType === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} fractal visualization`}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 fractal-overlay--primary animate-glow-orbit" />
        <div className="absolute -inset-24 opacity-30 blur-3xl fractal-overlay--aura animate-float-gradient" />
      </div>
    </div>
  );
}


