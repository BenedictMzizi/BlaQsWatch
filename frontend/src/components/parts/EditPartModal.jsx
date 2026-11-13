import AddPartModal from "./AddPartModal";
import { useUpdatePart } from "../../hooks/useParts";

export default function EditPartModal({
  part,
  open,
  onClose,
}) {
  const updatePart = useUpdatePart();

  if (!part) return null;

  function handleSave(form) {
    updatePart.mutate(
      {
        id: part.id,
        updates: form,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  }

  return (
    <AddPartModal
      open={open}
      onClose={onClose}
      title="Edit Part"
      initialValues={part}
      onSave={handleSave}
    />
  );
}