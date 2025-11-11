export default function Button({ as: As = "button", className = "", ...props }) {
    const base =
      "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition hover:opacity-90";
    const styles = "bg-emerald-500 text-white";
    return <As className={`${base} ${styles} ${className}`} {...props} />;
  }
  