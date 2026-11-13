import { useState, useEffect } from "react";

import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import TextArea from "../ui/TextArea";

const reasons = [
  "Purchase",
  "Sale",
  "Returned",
  "Damaged",
  "Warranty",
  "Stock Count",
  "Manual Adjustment",
];

export default function AdjustStockModal({
  open,
  onClose,
  part,
  onSave,
}) {
  const [movement, setMovement] = useState("ADD");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState(reasons[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setMovement("ADD");
      setQuantity(1);
      setReason(reasons[0]);
      setNotes("");
    }
  }, [open]);

  if (!part) return null;

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      partId: part.id,
      movement,
      quantity: Number(quantity),
      reason,
      notes,
    });

    onClose();
  }

  const newStock =
    movement === "ADD"
      ? part.quantity + Number(quantity)
      : Math.max(0, part.quantity - Number(quantity));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust Stock"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div className="rounded-lg bg-slate-100 p-4">
          <p className="text-sm text-slate-500">
            Current Stock
          </p>

          <h2 className="text-3xl font-bold">
            {part.quantity}
          </h2>

          <p className="mt-2 font-semibold">
            {part.partNumber}
          </p>

          <p className="text-sm text-slate-500">
            {part.description}
          </p>
        </div>

        <Select
          label="Movement"
          value={movement}
          onChange={(e) => setMovement(e.target.value)}
          options={[
            {
              value: "ADD",
              label: "➕ Add Stock",
            },
            {
              value: "REMOVE",
              label: "➖ Remove Stock",
            },
          ]}
        />

        <Input
          label="Quantity"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <div className="rounded-lg bg-blue-50 p-3">
          <span className="text-sm text-slate-600">
            New Stock:
          </span>

          <span className="ml-2 text-lg font-bold">
            {newStock}
          </span>
        </div>

        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={reasons.map((r) => ({
            value: r,
            label: r,
          }))}
        />

        <TextArea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button type="submit">
            Save Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}