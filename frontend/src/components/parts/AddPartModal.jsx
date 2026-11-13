import { useEffect, useState } from "react";

import Modal from "../ui/Modal";
import Button from "../ui/Button";
import PartForm from "./PartForm";


const defaultForm = {
  partNumber: "",
  oemNumber: "",
  description: "",
  categoryId: "",
  manufacturerId: "",
  supplierId: "",
  quantity: 0,
  minimumQuantity: 0,
  location: "",
  costPrice: "",
  sellingPrice: "",
  coolingType: "",
  notes: "",
};


export default function AddPartModal({
  open,
  onClose,
  onSave,
  title = "Add New Part",
  initialValues = defaultForm,
}) {


  const [form,setForm] = useState(defaultForm);



  useEffect(()=>{

    if(open){

      setForm({
        ...defaultForm,
        ...initialValues,
      });

    }

  },[open,initialValues]);



  function handleChange(e){

    setForm(prev=>({

      ...prev,

      [e.target.name]:
      e.target.value

    }));

  }




  function handleSubmit(e){

    e.preventDefault();


    const payload={


      part_number:
      form.partNumber,


      oem_number:
      form.oemNumber,


      description:
      form.description,



      category_id:
      form.categoryId,


      manufacturer_id:
      form.manufacturerId,


      supplier_id:
      form.supplierId,



      quantity:
      Number(form.quantity),



      minimum_stock:
      Number(form.minimumQuantity),



      buy_price:
      Number(form.costPrice),



      sell_price:
      Number(form.sellingPrice),



      shelf_location:
      form.location,



      notes:
      form.notes,

    };



    onSave(payload);



    setForm(defaultForm);


    onClose();

  }





  return (

    <Modal
      open={open}
      onClose={onClose}
      title={title}
    >


      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >


        <PartForm
          form={form}
          onChange={handleChange}
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
            Save Part
          </Button>


        </div>


      </form>


    </Modal>

  );

}