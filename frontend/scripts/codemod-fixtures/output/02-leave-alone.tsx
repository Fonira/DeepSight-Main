export function Demo() {
  return (
    <div>
      <p className="text-white">Pure white</p>
      <p className="text-emerald-400/60">Colored variant</p>
      <p className="bg-white/10 text-text-muted">Mixed bg + text</p>
      <p className="border-white/20">Border only</p>
      <p className="text-text-secondary">Already ok</p>
    </div>
  );
}
