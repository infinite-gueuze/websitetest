import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useFractalControls from '../hooks/useFractalControls.js';
import useFractalEngine from '../hooks/useFractalEngine.js';
import useAiFractalCurator from '../hooks/useAiFractalCurator.js';
import FractalCanvas from './fractal/FractalCanvas.jsx';
import FractalHeader from './fractal/FractalHeader.jsx';
import FractalControlPanel from './fractal/FractalControlPanel.jsx';
import StatusAnnouncer from './fractal/StatusAnnouncer.jsx';
import Button from './ui/Button.jsx';
import '../styles/fractal.css';

function BackgroundGlow() {
  return (
    <>
      <div className="pointer-events-none absolute -left-40 top-24 h-80 w-80 rounded-full fractal-orb--magenta blur-3xl sm:h-[26rem] sm:w-[26rem]" />
      <div className="pointer-events-none absolute -right-24 bottom-12 h-72 w-72 rounded-full fractal-orb--cyan blur-3xl sm:h-[24rem] sm:w-[24rem]" />
    </>
  );
}

export default function FractalExperience() {
  const controls = useFractalControls();
  const {
    canvasRef,
    containerRef,
    paletteData,
    statusMessage,
    fractalType,
    fractalVariant,
    paletteIndex,
    juliaSeed,
    autoZoomDirection,
    autoZoomPercent,
    isFullscreen,
    mutationsEnabled,
    currentVariantLabel,
    presetOptions,
    activePreset,
    constants,
    handlers,
  } = controls;

  const {
    AUTO_ZOOM_MIN_PERCENT,
    AUTO_ZOOM_MAX_PERCENT,
    MIN_RENDER_INTERVAL,
    MAX_DEVICE_PIXEL_RATIO,
    FRACTAL_VARIANTS,
  } = constants;

  const {
    handlePaletteShuffle,
    handlePaletteSet,
    handleFractalToggle,
    handleFractalReshuffle,
    handleJuliaReseed,
    handleJuliaSeedSet,
    handleManualZoom,
    handleResetView,
    handleAutoZoomDirectionToggle,
    handleMutationsToggle,
    handleVariantChange,
    handleAutoZoomSliderChange,
    handleFullscreenToggle,
    handlePresetSelect,
    handleStatusMessage,
  } = handlers;

  useFractalEngine({
    canvasRef,
    paletteData,
    computeRenderPayload: controls.engine.computeRenderPayload,
    minRenderInterval: MIN_RENDER_INTERVAL,
    maxDevicePixelRatio: MAX_DEVICE_PIXEL_RATIO,
  });

  const [aiEnabled, setAiEnabled] = useState(false);
  const lastDirectiveHashRef = useRef(null);

  const aiState = useMemo(
    () => ({
      fractalType,
      fractalVariant,
      paletteIndex,
      juliaSeed,
      autoZoomPercent,
      autoZoomDirection,
      mutationsEnabled,
      activePreset,
      statusMessage,
    }),
    [
      fractalType,
      fractalVariant,
      paletteIndex,
      juliaSeed,
      autoZoomPercent,
      autoZoomDirection,
      mutationsEnabled,
      activePreset,
      statusMessage,
    ],
  );

  const {
    isLoading: aiLoading,
    error: aiError,
    cadenceMs: aiCadenceMs,
    lastDirective,
    lastSource: aiLastSource,
    requestSuggestion,
  } = useAiFractalCurator({
    isEnabled: aiEnabled,
    currentState: aiState,
  });

  useEffect(() => {
    if (!aiEnabled || !lastDirective) {
      return;
    }

    const hash = JSON.stringify(lastDirective);
    if (hash === lastDirectiveHashRef.current) {
      return;
    }
    lastDirectiveHashRef.current = hash;

    if (lastDirective.fractalType && lastDirective.fractalType !== fractalType) {
      handleFractalToggle();
    }

    if (
      Number.isFinite(lastDirective.paletteIndex) &&
      lastDirective.paletteIndex !== paletteIndex
    ) {
      handlePaletteSet(lastDirective.paletteIndex, { announce: false });
    }

    if (
      lastDirective.variant &&
      lastDirective.variant !== fractalVariant &&
      fractalType === 'mandelbrot'
    ) {
      handleVariantChange({ target: { value: lastDirective.variant } });
    }

    if (
      Number.isFinite(lastDirective.autoZoomPercent) &&
      lastDirective.autoZoomPercent !== autoZoomPercent
    ) {
      handleAutoZoomSliderChange({ target: { value: `${lastDirective.autoZoomPercent}` } });
    }

    if (
      lastDirective.autoZoomDirection &&
      lastDirective.autoZoomDirection !== autoZoomDirection
    ) {
      handleAutoZoomDirectionToggle();
    }

    if (
      typeof lastDirective.mutationsEnabled === 'boolean' &&
      lastDirective.mutationsEnabled !== mutationsEnabled
    ) {
      handleMutationsToggle();
    }

    if (lastDirective.preset && lastDirective.preset !== activePreset) {
      handlePresetSelect(lastDirective.preset);
    }

    if (lastDirective.juliaSeed && fractalType === 'julia') {
      handleJuliaSeedSet(lastDirective.juliaSeed, { announce: false });
    }

    if (lastDirective.statusMessage) {
      handleStatusMessage(lastDirective.statusMessage);
    }
  }, [
    activePreset,
    aiEnabled,
    autoZoomDirection,
    autoZoomPercent,
    fractalType,
    fractalVariant,
    handleAutoZoomDirectionToggle,
    handleAutoZoomSliderChange,
    handleFractalToggle,
    handleJuliaSeedSet,
    handleMutationsToggle,
    handlePaletteSet,
    handlePresetSelect,
    handleStatusMessage,
    handleVariantChange,
    lastDirective,
    mutationsEnabled,
    paletteIndex,
  ]);

  const aiStatus = useMemo(() => {
    if (!aiEnabled) return 'Paused';
    if (aiLoading) return 'Curating';
    if (aiError) return 'Fallback ready';
    if (aiCadenceMs) {
      return `Next ${(aiCadenceMs / 1000).toFixed(0)}s`;
    }
    return 'Ready';
  }, [aiEnabled, aiLoading, aiError, aiCadenceMs]);

  const handleAiToggle = useCallback(() => {
    setAiEnabled((prev) => !prev);
  }, []);

  const handleAiRefresh = useCallback(() => {
    requestSuggestion({ forceSchedule: true }).catch(() => {});
  }, [requestSuggestion]);

  return (
    <section className={`relative isolate overflow-hidden ${isFullscreen ? 'h-screen' : 'px-4 py-12 sm:py-16'}`}>
      {!isFullscreen && <BackgroundGlow />}
      <div
        ref={containerRef}
        className={`relative z-10 mx-auto flex w-full ${
          isFullscreen ? 'max-w-none h-full' : 'max-w-6xl'
        } flex-col gap-8 rounded-3xl bg-slate-900/70 p-6 shadow-xl ring-1 ring-slate-700/40 backdrop-blur transition-shadow duration-500 hover:shadow-2xl md:p-10 ${
          isFullscreen ? 'justify-center' : ''
        }`}
      >
        <FractalCanvas canvasRef={canvasRef} fractalType={fractalType} isFullscreen={isFullscreen} />

        {!isFullscreen && (
          <>
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <FractalHeader fractalType={fractalType} />
            </div>

            <FractalControlPanel
              fractalType={fractalType}
              fractalVariant={fractalVariant}
              paletteIndex={paletteIndex}
              autoZoomPercent={autoZoomPercent}
              autoZoomRange={{ min: AUTO_ZOOM_MIN_PERCENT, max: AUTO_ZOOM_MAX_PERCENT }}
              autoZoomDirection={autoZoomDirection}
              mutationsEnabled={mutationsEnabled}
              currentVariantLabel={currentVariantLabel}
              variants={FRACTAL_VARIANTS}
              presetOptions={presetOptions}
              activePreset={activePreset}
              isFullscreen={isFullscreen}
              onFullscreenToggle={handleFullscreenToggle}
              onPaletteShuffle={handlePaletteShuffle}
              onFractalToggle={handleFractalToggle}
              onFractalReshuffle={handleFractalReshuffle}
              onManualZoomIn={() => handleManualZoom('in')}
              onManualZoomOut={() => handleManualZoom('out')}
              onResetView={handleResetView}
              onJuliaReseed={handleJuliaReseed}
              onAutoZoomDirectionToggle={handleAutoZoomDirectionToggle}
              onMutationsToggle={handleMutationsToggle}
              onVariantChange={handleVariantChange}
              onAutoZoomChange={handleAutoZoomSliderChange}
              onPresetSelect={handlePresetSelect}
              aiEnabled={aiEnabled}
              aiLoading={aiLoading}
              aiStatus={aiStatus}
              aiLastSource={aiLastSource}
              onAiToggle={handleAiToggle}
              onAiRefresh={handleAiRefresh}
            />
          </>
        )}

        {isFullscreen && (
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <Button onClick={handleFullscreenToggle}>Exit Fullscreen</Button>
          </div>
        )}
      </div>
      <StatusAnnouncer message={statusMessage} />
    </section>
  );
}

