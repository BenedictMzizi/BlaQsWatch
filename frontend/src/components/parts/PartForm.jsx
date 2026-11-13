import Input from "../ui/Input";
import Select from "../ui/Select";
import TextArea from "../ui/TextArea";

import useCategories from "../../hooks/useCategories";
import useManufacturers from "../../hooks/useManufacturers";
import useSuppliers from "../../hooks/useSuppliers";


const coolingTypes = [
  {
    value: "Oil",
    label: "Oil Cooled",
  },
  {
    value: "Water",
    label: "Water Cooled",
  },
  {
    value: "Oil & Water",
    label: "Oil & Water",
  },
];


export default function PartForm({
  form,
  onChange,
}) {


  const {
    categories = []
  } = useCategories();


  const {
    manufacturers = []
  } = useManufacturers();


  const {
    suppliers = []
  } = useSuppliers();



  const turboCategory =
    categories.find(
      (c) => c.name === "Turbo"
    );


  const isTurbo =
    form.categoryId === turboCategory?.id;



  return (

    <div className="grid gap-4 md:grid-cols-2">


      <Input
        label="Part Number"
        name="partNumber"
        value={form.partNumber}
        onChange={onChange}
        required
      />


      <Input
        label="OEM Number"
        name="oemNumber"
        value={form.oemNumber}
        onChange={onChange}
      />


      <Input
        label="Description"
        name="description"
        value={form.description}
        onChange={onChange}
        required
      />



      <Select
        label="Category"
        name="categoryId"
        value={form.categoryId}
        onChange={onChange}

        options={
          categories.map((category)=>({
            value: category.id,
            label: category.name,
          }))
        }
      />



      <Select
        label="Manufacturer"
        name="manufacturerId"
        value={form.manufacturerId}
        onChange={onChange}

        options={
          manufacturers.map((manufacturer)=>({
            value: manufacturer.id,
            label: manufacturer.name,
          }))
        }
      />



      <Select
        label="Supplier"
        name="supplierId"
        value={form.supplierId}
        onChange={onChange}

        options={
          suppliers.map((supplier)=>({
            value: supplier.id,
            label: supplier.company_name,
          }))
        }
      />



      <Input
        type="number"
        label="Quantity"
        name="quantity"
        value={form.quantity}
        onChange={onChange}
      />



      <Input
        type="number"
        label="Minimum Stock"
        name="minimumQuantity"
        value={form.minimumQuantity}
        onChange={onChange}
      />



      <Input
        label="Shelf Location"
        name="location"
        value={form.location}
        onChange={onChange}
      />



      <Input
        type="number"
        label="Buy Price"
        name="costPrice"
        value={form.costPrice}
        onChange={onChange}
      />



      <Input
        type="number"
        label="Sell Price"
        name="sellingPrice"
        value={form.sellingPrice}
        onChange={onChange}
      />



      {
        isTurbo &&

        <Select
          label="Cooling Type"
          name="coolingType"
          value={form.coolingType}
          onChange={onChange}
          options={coolingTypes}
        />

      }



      <div className="md:col-span-2">

        <TextArea
          label="Notes"
          name="notes"
          value={form.notes}
          onChange={onChange}
        />

      </div>


    </div>

  );

}