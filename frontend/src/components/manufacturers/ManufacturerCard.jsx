import Card from "../ui/Card";

export default function ManufacturerCard({
  manufacturer,
}) {
  return (
    <Card>
      <h3 className="text-lg font-semibold">
        {manufacturer.name}
      </h3>

      <p className="text-sm text-slate-500">
        {manufacturer.country}
      </p>
    </Card>
  );
}