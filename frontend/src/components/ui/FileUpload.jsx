import { PhotoIcon } from "@heroicons/react/24/outline";

export default function FileUpload({
  onChange,
  multiple = false,
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 hover:border-blue-500">
      <PhotoIcon className="h-12 w-12 text-slate-400" />

      <span className="mt-3 text-sm text-slate-500">
        Click to upload image
      </span>

      <input
        hidden
        type="file"
        multiple={multiple}
        onChange={onChange}
      />
    </label>
  );
}