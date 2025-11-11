export default function Slider({ className = '', ...props }) {
  return (
    <input
      type="range"
      className={`h-1 flex-1 cursor-ew-resize appearance-none rounded-full bg-slate-700 accent-fuchsia-500 ${className}`}
      {...props}
    />
  );
}


