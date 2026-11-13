import Input from "../ui/Input";
import Button from "../ui/Button";

export default function ManufacturerForm({
  form,
  onChange,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
    >
      <Input
        label="Manufacturer Name"
        name="name"
        value={form.name}
        onChange={onChange}
        required
      />

      <Input
        label="Country"
        name="country"
        value={form.country}
        onChange={onChange}
      />

      <Button type="submit">
        Save Manufacturer
      </Button>
    </form>
  );
}