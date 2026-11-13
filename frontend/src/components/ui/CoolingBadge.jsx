export default function CoolingBadge({ type }) {
  if (!type) {
    return (
      <span className="text-slate-400">
        —
      </span>
    );
  }

  const badges = {
    Oil: {
      icon: "🛢",
      text: "Oil",
      className:
        "bg-amber-100 text-amber-800 border border-amber-200",
    },

    Water: {
      icon: "💧",
      text: "Water",
      className:
        "bg-blue-100 text-blue-800 border border-blue-200",
    },

    "Oil & Water": {
      icon: "🛢💧",
      text: "Oil & Water",
      className:
        "bg-cyan-100 text-cyan-800 border border-cyan-200",
    },
  };

  const badge = badges[type];

  if (!badge) {
    return (
      <span className="text-slate-400">
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
    >
      <span>{badge.icon}</span>
      {badge.text}
    </span>
  );
}