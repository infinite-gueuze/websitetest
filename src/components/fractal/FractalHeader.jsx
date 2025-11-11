export default function FractalHeader({ fractalType }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Fractal Lab</p>
      <h1 className="text-3xl font-semibold text-slate-100 sm:text-4xl">
        Psychedelic {fractalType === 'mandelbrot' ? 'Mandelbrot' : 'Julia'} Explorer
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-slate-400">
        Let the living zoom pull you deeper, shuffle the palette, and reroll between Mandelbrot or Julia sets for endless
        visual trips.
      </p>
    </div>
  );
}


