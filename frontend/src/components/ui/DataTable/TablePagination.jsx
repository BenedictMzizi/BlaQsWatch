export default function TablePagination({
  page,
  totalPages,
  onPrevious,
  onNext,
}) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
      <span className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </span>

      <div className="flex gap-2">
        <button
          onClick={onPrevious}
          disabled={page <= 1}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Previous
        </button>

        <button
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}