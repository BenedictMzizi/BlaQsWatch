import { useNavigate } from "react-router-dom";

import DataTable from "../ui/DataTable/DataTable";
import { getPartColumns } from "../../constants/partColumns";
import LoadingSpinner from "../ui/LoadingSpinner";

import useCategories from "../../hooks/useCategories";
import useManufacturers from "../../hooks/useManufacturers";
import useVehicles from "../../hooks/useVehicles";

export default function PartTable({
  parts = [],
  loading = false,
}) {
    const { categories } = useCategories(); 
    const { manufacturers } = useManufacturers();
    const { vehicles } = useVehicles();
    const navigate = useNavigate();

  const columns = getPartColumns({

    categories,
    manufacturers,
    vehicles,

    onView: (part) => navigate(`/parts/${part.id}`),

    onEdit: (part) =>
      navigate(`/parts/${part.id}/edit`),

    onAdjustStock: (part) =>
      console.log("Adjust", part),

    onDuplicate: (part) =>
      console.log("Duplicate", part),

    onDelete: (part) =>
      console.log("Delete", part),
  });

  if (loading) {
    return (
        <LoadingSpinner text="Loading Parts..." />
    ); 
  }

  if (!parts.length) {
    return (
      <div className="py-16 text-center text-slate-500">
        No parts found.
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={parts}
    />
  );
}