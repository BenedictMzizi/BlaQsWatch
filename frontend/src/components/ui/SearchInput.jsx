import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <MagnifyingGlassIcon
        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
      />

      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="
          w-full
          rounded-lg
          border
          border-slate-300
          bg-white
          py-2.5
          pl-10
          pr-4
          text-sm
          focus:border-blue-500
          focus:outline-none
          focus:ring-2
          focus:ring-blue-200
        "
      />
    </div>
  );
}