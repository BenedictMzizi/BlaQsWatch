export default function LoadingSpinner({
  text = "Loading...",
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />

      <p className="text-sm text-slate-500">
        {text}
      </p>
    </div>
  );
}