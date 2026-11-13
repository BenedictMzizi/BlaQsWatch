import SearchInput from "../ui/SearchInput";
import Select from "../ui/Select";

export default function PartFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  manufacturer,
  onManufacturerChange,
  categories = [],
  manufacturers = [],
}) {
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <SearchInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search by part number, OEM, vehicle..."
      />

      <Select
        label="Category"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        options={categories}
      />

      <Select
        label="Manufacturer"
        value={manufacturer}
        onChange={(e) => onManufacturerChange(e.target.value)}
        options={manufacturers}
      />
    </div>
  );
}