import { productStats } from "@/lib/app-data";

export function StatsBar() {
  return (
    <dl className="grid gap-4 rounded-3xl border border-white/5 bg-slate-900/40 p-6 text-center sm:grid-cols-3">
      {productStats.map((stat) => (
        <div key={stat.label}>
          <dt className="text-sm text-slate-400">{stat.label}</dt>
          <dd className="text-2xl font-semibold text-white">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
