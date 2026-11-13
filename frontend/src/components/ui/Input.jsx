export default function Input({
  label,
  error,
  className = "",
  ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <input
        {...props}
        className="
          w-full
          rounded-lg
          border
          border-slate-300
          px-3
          py-2.5
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