export default function DesktopNotice() {
  return (
    <div className="bg-accent/10 ring-accent/30 mb-5 rounded-2xl p-4 ring-1 sm:hidden">
      <p className="text-accent text-sm font-semibold">Better on a computer</p>
      <p className="text-ink-soft mt-1 text-xs">
        Building a tournament takes a lot of setup. You can do it here, but a
        laptop will be much easier.
      </p>
    </div>
  );
}
