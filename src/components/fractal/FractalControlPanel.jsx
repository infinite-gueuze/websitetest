import Button from '../ui/Button.jsx';
import Toggle from '../ui/Toggle.jsx';
import Slider from '../ui/Slider.jsx';
import PresetSelector from './PresetSelector.jsx';
import { formatVariantLabel } from '../../utils/fractalControls.js';

export default function FractalControlPanel({
  fractalType,
  fractalVariant,
  paletteIndex,
  autoZoomPercent,
  autoZoomRange,
  autoZoomDirection,
  mutationsEnabled,
  currentVariantLabel,
  variants,
  presetOptions,
  activePreset,
  isFullscreen,
  onFullscreenToggle,
  onPaletteShuffle,
  onFractalToggle,
  onFractalReshuffle,
  onManualZoomIn,
  onManualZoomOut,
  onResetView,
  onJuliaReseed,
  onAutoZoomDirectionToggle,
  onMutationsToggle,
  onVariantChange,
  onAutoZoomChange,
  onPresetSelect,
  aiEnabled,
  aiLoading,
  aiStatus,
  aiLastSource,
  onAiToggle,
  onAiRefresh,
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-start gap-3 md:gap-4">
          <Button onClick={onFullscreenToggle} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
          <Button onClick={onPaletteShuffle}>Randomize Colors</Button>
          <Button onClick={onFractalToggle}>
            Switch to {fractalType === 'mandelbrot' ? 'Julia' : 'Mandelbrot'}
          </Button>
          <Button onClick={onFractalReshuffle} variant="accent">
            Shuffle Everything
          </Button>
          <Button onClick={onManualZoomIn}>Zoom In</Button>
          <Button onClick={onManualZoomOut}>Zoom Out</Button>
          <Button onClick={onResetView} variant="outline">
            Reset View
          </Button>
          {fractalType === 'julia' && (
            <Button onClick={onJuliaReseed} variant="cyan">
              New Julia Seed
            </Button>
          )}
        </div>

        <label className="flex w-full max-w-xl items-center gap-3 text-sm text-slate-300">
          <span className="font-medium text-slate-100">Auto Zoom Speed</span>
          <Slider
            min={autoZoomRange.min}
            max={autoZoomRange.max}
            value={autoZoomPercent}
            onChange={onAutoZoomChange}
            aria-valuetext={`${autoZoomPercent}%`}
          />
          <span className="w-12 text-right font-mono text-xs text-slate-400">{autoZoomPercent}%</span>
        </label>
      </div>

      <div className="flex flex-col gap-5 text-sm text-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <Toggle pressed={autoZoomDirection === 1} onClick={onAutoZoomDirectionToggle}>
            Reverse Flow ({autoZoomDirection === -1 ? 'In' : 'Out'})
          </Toggle>
          <Toggle pressed={mutationsEnabled} onClick={onMutationsToggle}>
            Auto Mutations: {mutationsEnabled ? 'On' : 'Off'}
          </Toggle>
          <Toggle pressed={aiEnabled} onClick={onAiToggle}>
            AI Guide: {aiEnabled ? 'On' : 'Off'}
          </Toggle>
          <Button onClick={onAiRefresh} disabled={!aiEnabled || aiLoading}>
            {aiLoading ? 'AI Thinking…' : 'Refresh with AI'}
          </Button>

          {fractalType === 'mandelbrot' && (
            <label className="flex items-center gap-2 rounded-full bg-slate-100/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-slate-300">
              Variant
              <select
                value={fractalVariant}
                onChange={onVariantChange}
                className="cursor-pointer rounded-full bg-slate-900/70 px-3 py-1 font-sans text-[0.7rem] uppercase tracking-[0.2em] text-slate-200 outline-none"
              >
                {variants.map((variant) => (
                  <option key={variant} value={variant}>
                    {formatVariantLabel(variant)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-slate-100/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">
            Palette #{paletteIndex + 1}
          </div>
          <div className="rounded-full bg-slate-100/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-slate-300">
            Variant: {currentVariantLabel}
          </div>
          {aiEnabled && (
            <div className="rounded-full bg-emerald-400/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-emerald-300">
              AI {aiLastSource === 'fallback' ? 'Fallback' : 'Active'} • {aiStatus}
            </div>
          )}
        </div>

        <PresetSelector presets={presetOptions} activePreset={activePreset} onSelect={onPresetSelect} />
      </div>
    </div>
  );
}


