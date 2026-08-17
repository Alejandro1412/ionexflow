export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6" aria-busy aria-label="Loading">
      <div className="h-9 w-48 rounded-md bg-white/10" />
      <div className="h-4 w-80 max-w-full rounded bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-xl border border-white/10 bg-white/5" />
        <div className="h-28 rounded-xl border border-white/10 bg-white/5" />
        <div className="h-28 rounded-xl border border-white/10 bg-white/5" />
      </div>
    </div>
  );
}
