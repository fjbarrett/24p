import { featureHighlights } from "@/lib/app-data";

export function FeatureGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {featureHighlights.map((feature) => (
        <article key={feature.title} className="rounded-3xl border border-white/5 bg-black-900/40 p-5">
          <span className="text-xs uppercase tracking-[0.3em] text-black-300">{feature.badge}</span>
          <h3 className="mt-2 text-xl font-semibold text-white">{feature.title}</h3>
          <p className="mt-1 text-sm text-black-400">{feature.body}</p>
        </article>
      ))}
    </div>
  );
}
