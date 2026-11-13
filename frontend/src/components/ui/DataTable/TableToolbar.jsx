import SearchInput from "../SearchInput";

export default function TableToolbar({
  search,
  setSearch,
  children,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2">
        {children}
      </div>
    </div>
  );
}