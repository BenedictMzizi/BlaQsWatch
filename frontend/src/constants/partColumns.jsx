import StatusBadge from "../components/ui/StatusBadge";
import CoolingBadge from "../components/ui/CoolingBadge";
import RowActions from "../components/ui/DataTable/RowActions";


export function getPartColumns({
  categories = [],
  manufacturers = [],
  vehicles = [],
  onView,
  onEdit,
  onAdjustStock,
  onDuplicate,
  onDelete,
}) {


return [

{
  accessorKey:"part_number",
  header:"Part Number",
},


{
  accessorKey:"description",
  header:"Description",
},



{
  header:"Category",

  cell:({row})=>{

    const category =
      categories.find(
        c=>c.id === row.original.category_id
      );


    return category?.name ?? "-";

  }

},



{
  header:"Manufacturer",

  cell:({row})=>{

    const manufacturer =
      manufacturers.find(
        m=>m.id === row.original.manufacturer_id
      );


    return manufacturer?.name ?? "-";

  }

},




{
  header:"Supplier",

  cell:({row})=>
    row.original.suppliers?.company_name ?? "-"

},



{
  accessorKey:"quantity",
  header:"Qty",
},



{
  accessorKey:"shelf_location",
  header:"Location",
},



{
  header:"Status",

  cell:({row})=>(

    <StatusBadge

      quantity={
        row.original.quantity
      }

      minimum={
        row.original.minimum_stock
      }

    />

  )

},




{
  header:"Cooling",

  cell:({row})=>(

    <CoolingBadge

      type={
        row.original.cooling_type
      }

    />

  )

},




{
 id:"actions",

 header:"Actions",

 enableSorting:false,


 cell:({row})=>(

 <RowActions

    onView={()=>
      onView(row.original)
    }


    onEdit={()=>
      onEdit(row.original)
    }


    onAdjustStock={()=>
      onAdjustStock(row.original)
    }


    onDuplicate={()=>
      onDuplicate(row.original)
    }


    onDelete={()=>
      onDelete(row.original)
    }

 />

 )

}


];

}