export const mockParts = [
  {
    id: 1,

    image: "https://via.placeholder.com/60x60?text=Turbo",

    partNumber: "53039880248",
    oemNumber: "17201-0L040",

    description: "GT2052V Turbo Charger",

    categoryId: 1,
    manufacturerId: 1,
    supplierId: 1,

    vehicleIds: [1, 7],

    quantity: 12,
    minimumQuantity: 5,

    location: "A-01-02",

    costPrice: 4200,
    sellingPrice: 5900,

    coolingType: "Oil",

    notes: "OEM replacement",

    createdAt: "2026-08-12",
    updatedAt: "2026-08-12",
  },

  {
    id: 2,

    image: "https://via.placeholder.com/60x60?text=Rad",

    partNumber: "RAD1001",
    oemNumber: "16400-0L110",

    description: "Aluminium Radiator",

    categoryId: 2,
    manufacturerId: 5,
    supplierId: 2,

    vehicleIds: [1],

    quantity: 3,
    minimumQuantity: 5,

    location: "B-02-01",

    costPrice: 1800,
    sellingPrice: 2600,

    coolingType: "",

    notes: "",

    createdAt: "2026-08-12",
    updatedAt: "2026-08-12",
  },

  {
    id: 3,

    image: "https://via.placeholder.com/60x60?text=INT",

    partNumber: "INT203",
    oemNumber: "FMIC203",

    description: "Front Mount Intercooler",

    categoryId: 3,
    manufacturerId: 6,
    supplierId: 3,

    vehicleIds: [2],

    quantity: 0,
    minimumQuantity: 2,

    location: "C-03-01",

    costPrice: 2500,
    sellingPrice: 3400,

    coolingType: "",

    notes: "",

    createdAt: "2026-08-12",
    updatedAt: "2026-08-12",
  },
];