import DataTable from "../ui/DataTable/DataTable";

export default function ManufacturerList({
  columns,
  manufacturers,
  loading,
}) {
  return (
    <DataTable
      columns={columns}
      data={manufacturers}
      loading={loading}
    />
  );
}