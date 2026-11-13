import {
  CubeIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import StatCard from "../../components/dashboard/StatCard";

export default function Dashboard() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold">
          Dashboard
        </h1>

        <p className="text-slate-500">
          Welcome to Mzizis' Inventory Tracker
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <StatCard
          title="Total Parts"
          value="1,245"
          icon={CubeIcon}
        />

        <StatCard
          title="Inventory Value"
          value="R 582,340"
          icon={BanknotesIcon}
          color="green"
        />

        <StatCard
          title="Low Stock"
          value="18"
          icon={ExclamationTriangleIcon}
          color="amber"
        />

        <StatCard
          title="Out Of Stock"
          value="4"
          icon={XCircleIcon}
          color="red"
        />

      </div>

      <div className="grid gap-6 xl:grid-cols-3">

        <div className="rounded-xl border bg-white p-6 xl:col-span-2">

          <h2 className="mb-4 text-lg font-semibold">
            Inventory Overview
          </h2>

          <div className="flex h-72 items-center justify-center rounded-lg border-2 border-dashed text-slate-400">

            Chart Coming Soon

          </div>

        </div>

        <div className="rounded-xl border bg-white p-6">

          <h2 className="mb-4 text-lg font-semibold">
            Quick Actions
          </h2>

          <div className="space-y-3">

            <button className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">
              + Add Part
            </button>

            <button className="w-full rounded-lg bg-green-600 px-4 py-3 font-medium text-white hover:bg-green-700">
              + Receive Stock
            </button>

            <button className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700">
              + Issue Stock
            </button>

          </div>

        </div>

      </div>

      <div className="grid gap-6 xl:grid-cols-2">

        <div className="rounded-xl border bg-white p-6">

          <h2 className="mb-4 text-lg font-semibold">
            Recent Stock Movements
          </h2>

          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed text-slate-400">

            Recent Movements

          </div>

        </div>

        <div className="rounded-xl border bg-white p-6">

          <h2 className="mb-4 text-lg font-semibold">
            Low Stock Items
          </h2>

          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed text-slate-400">

            Low Stock Table

          </div>

        </div>

      </div>

    </div>
  );
}