export default function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className="text-3xl font-bold"
        style={{ color: accent || "#1B2A4A" }}
      >
        {value ?? "—"}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}
