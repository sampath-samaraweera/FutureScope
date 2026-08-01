interface PlotCardProps {
  title: string;
  src?: string;
  description?: string;
}

export default function PRCurveChart({ title, src, description }: PlotCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-md bg-slate-50">
        {src ? (
          <img src={src} alt={title} className="max-h-80 w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">Plot not available yet.</span>
        )}
      </div>
    </div>
  );
}
