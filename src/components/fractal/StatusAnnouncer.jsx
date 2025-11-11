export default function StatusAnnouncer({ message }) {
  return (
    <span aria-live="polite" role="status" className="sr-only">
      {message}
    </span>
  );
}


