export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold text-dome-600">Dome</span>
        <nav className="flex gap-4 text-sm">
          <a href="/facilities" className="hover:text-dome-600">Find a Court</a>
          <a href="/open-games" className="hover:text-dome-600">Open Games</a>
          <a href="/login" className="hover:text-dome-600">Sign in</a>
          <a href="/register" className="rounded-dome bg-dome-600 px-3 py-1.5 text-white hover:bg-dome-700">
            Get started
          </a>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Book sports facilities<br />
          <span className="text-dome-600">across Canada</span>
        </h1>
        <p className="max-w-md text-lg text-gray-600">
          Find and reserve courts, fields, and arenas near you — or join an open game and split the cost.
        </p>
        <div className="flex gap-3">
          <a href="/facilities" className="rounded-dome bg-dome-600 px-5 py-2.5 text-white font-medium hover:bg-dome-700">
            Browse facilities
          </a>
          <a href="/open-games" className="rounded-dome border px-5 py-2.5 font-medium hover:bg-gray-50">
            Join an open game
          </a>
        </div>
      </section>
    </main>
  );
}
