import Button from '../ui/Button.jsx';

export default function PresetSelector({ presets, activePreset, onSelect }) {
  if (!presets?.length) {
    return null;
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
        Presets
      </span>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const isActive = preset.name === activePreset;
          return (
            <Button
              key={preset.name}
              variant={isActive ? 'accent' : 'ghost'}
              onClick={() => onSelect?.(preset.name)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}


