import {
  Eye,
  Pencil,
  PackagePlus,
  Copy,
  Trash2,
} from "lucide-react";

export default function RowActions({
  onView,
  onEdit,
  onAdjustStock,
  onDuplicate,
  onDelete,
}) {
  const actions = [
    {
      icon: Eye,
      title: "View",
      onClick: onView,
      color: "text-slate-600 hover:text-blue-600",
    },
    {
      icon: Pencil,
      title: "Edit",
      onClick: onEdit,
      color: "text-slate-600 hover:text-green-600",
    },
    {
      icon: PackagePlus,
      title: "Adjust Stock",
      onClick: onAdjustStock,
      color: "text-slate-600 hover:text-orange-600",
    },
    {
      icon: Copy,
      title: "Duplicate",
      onClick: onDuplicate,
      color: "text-slate-600 hover:text-purple-600",
    },
    {
      icon: Trash2,
      title: "Delete",
      onClick: onDelete,
      color: "text-red-600 hover:text-red-800",
    },
  ];

  return (
    <div className="flex items-center justify-center gap-2">
      {actions.map(({ icon: Icon, title, onClick, color }) => (
        <button
          key={title}
          type="button"
          title={title}
          onClick={onClick}
          className={`rounded-md p-2 transition-colors hover:bg-slate-100 ${color}`}
        >
          <Icon size={18} />
        </button>
      ))}
    </div>
  );
}