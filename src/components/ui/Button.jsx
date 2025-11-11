const BASE_CLASSES = [
  'inline-flex items-center justify-center gap-2',
  'rounded-full px-4 py-2 text-sm font-medium uppercase tracking-[0.18em]',
  'transition duration-200 ease-out',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400',
  'hover:-translate-y-[1px]',
];

const VARIANT_CLASSES = {
  neutral:
    'bg-slate-100/10 text-slate-100 hover:bg-slate-100/20 hover:shadow-lg hover:shadow-[0_16px_32px_rgba(15,23,42,0.35)]',
  accent:
    'bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30 hover:shadow-[0_18px_45px_rgba(217,70,239,0.35)]',
  cyan:
    'bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 hover:shadow-[0_18px_45px_rgba(14,165,233,0.35)]',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-100/10 hover:text-slate-100',
  outline:
    'border border-slate-700/60 bg-slate-900/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800/60',
};

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Button({
  as: Component = 'button',
  variant = 'neutral',
  className = '',
  children,
  ...props
}) {
  const variantClasses = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.neutral;
  const composed = joinClasses(BASE_CLASSES.join(' '), variantClasses, className);
  const ComponentTag = Component;
  return (
    <ComponentTag className={composed} {...props}>
      {children}
    </ComponentTag>
  );
}

