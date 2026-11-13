import {
  HomeIcon,
  CubeIcon,
  ArchiveBoxIcon,
  TruckIcon,
  BuildingOffice2Icon,
  UsersIcon,
  TagIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

export const navigation = [
  {
    name: "Dashboard",
    path: "/",
    icon: HomeIcon,
  },
  {
    name: "Parts",
    path: "/parts",
    icon: CubeIcon,
  },
  {
    name: "Inventory",
    path: "/inventory",
    icon: ArchiveBoxIcon,
  },
  {
    name: "Vehicles",
    path: "/vehicles",
    icon: TruckIcon,
  },
  {
    name: "Manufacturers",
    path: "/manufacturers",
    icon: BuildingOffice2Icon,
  },
  {
    name: "Suppliers",
    path: "/suppliers",
    icon: UsersIcon,
  },
  {
    name: "Categories",
    path: "/categories",
    icon: TagIcon,
  },
  {
    name: "Reports",
    path: "/reports",
    icon: ChartBarIcon,
  },
  {
    name: "Settings",
    path: "/settings",
    icon: Cog6ToothIcon,
  },
];