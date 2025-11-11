import Button from './Button.jsx';

function joinClasses(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Toggle({
  pressed,
  variant = 'outline',
  className = '',
  children,
  ...props
}) {
  const stateClasses = pressed
    ? 'data-[pressed=true]:bg-cyan-500/20 data-[pressed=true]:text-cyan-100 shadow-lg shadow-cyan-500/10'
    : 'data-[pressed=false]:opacity-90';

  return (
    <Button
      {...props}
      variant={variant}
      aria-pressed={pressed}
      data-pressed={pressed}
      className={joinClasses(stateClasses, className)}
    >
      {children}
    </Button>
  );
}


