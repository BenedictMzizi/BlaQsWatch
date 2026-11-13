export default function TextArea({
  label,
  error,
  className = "",
  rows = 4,
  ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <textarea
        rows={rows}
        {...props}
        className="
          w-full
          rounded-lg
          border
          border-slate-300
          px-3
          py-2.5
          resize-none
          focus:border-blue-500
          focus:outline-none
          focus:ring-2
          focus:ring-blue-200
        "
      />

      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}