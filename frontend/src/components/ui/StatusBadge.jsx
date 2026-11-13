export default function StatusBadge({
  quantity = 0,
  minimum = 0,
  discontinued = false,
}) {
  let badge = {
    icon: "🟢",
    text: "In Stock",
    className:
      "bg-green-100 text-green-800 border border-green-200",
  };

  if (discontinued) {
    badge = {
      icon: "⚫",
      text: "Discontinued",
      className:
        "bg-slate-100 text-slate-700 border border-slate-200",
    };
  } else if (quantity <= 0) {
    badge = {
      icon: "🔴",
      text: "Out of Stock",
      className:
        "bg-red-100 text-red-800 border border-red-200",
    };
  } else if (quantity <= minimum) {
    badge = {
      icon: "🟡",
      text: "Low Stock",
      className:
        "bg-yellow-100 text-yellow-800 border border-yellow-200",
    };
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