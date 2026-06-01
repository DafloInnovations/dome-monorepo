export default function AdminDashboard() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b bg-white px-6 py-4 flex items-center gap-3">
        <span className="text-lg font-bold text-dome-600">Dome</span>
        <span className="text-sm text-gray-400 font-medium">Admin</span>
      </header>

      <div className="flex flex-1">
        <aside className="w-56 border-r bg-white px-4 py-6 flex flex-col gap-1 text-sm">
          {["Dashboard", "Facilities", "Bookings", "Users", "Vendors", "Payments", "Reviews"].map((item) => (
            <a
              key={item}
              href={`/admin/${item.toLowerCase()}`}
              className="rounded-md px-3 py-2 text-gray-700 hover:bg-dome-50 hover:text-dome-700"
            >
              {item}
            </a>
          ))}
        </aside>

        <div className="flex-1 p-8">
          <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Total Bookings", value: "—" },
              { label: "Active Facilities", value: "—" },
              { label: "Registered Users", value: "—" },
              { label: "Revenue (MTD)", value: "—" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-dome border bg-white p-4">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
