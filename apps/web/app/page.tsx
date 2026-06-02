import type { Metadata } from "next";
import Link from "next/link";
import { SPORTS, CITIES } from "../lib/cities";

export const metadata: Metadata = {
  title: "Dome — Book Sports Facilities in Canada",
  description: "Find and book badminton courts, tennis courts, soccer fields and more across Canada. Instant booking, real-time availability.",
  openGraph: {
    title: "Dome — Book Sports Facilities in Canada",
    description: "Find and book sports courts across Canada. Instant booking, real-time availability.",
    url: "https://dome.ca",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Dome",
  url: "https://dome.ca",
  description: "Sports facility booking platform across Canada",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://dome.ca/facilities?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const STEPS = [
  { num: "01", title: "Search", desc: "Find facilities near you by sport, city, and date." },
  { num: "02", title: "Book",   desc: "Reserve your slot instantly with secure payment." },
  { num: "03", title: "Play",   desc: "Show up and play. It's that simple." },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="relative bg-black overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(232,80,104,0.15),transparent)]" />
          <div className="relative max-w-6xl mx-auto px-4 pt-24 pb-20 text-center">
            <span className="inline-block bg-primary/10 border border-primary/30 text-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
              🇨🇦 Available across Canada
            </span>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-none mb-6">
              Book Your<br />
              <span className="text-primary">Next Game</span>
            </h1>
            <p className="text-lg md:text-xl text-muted max-w-xl mx-auto mb-10">
              Find and book sports facilities across Canada. Real-time availability, instant confirmation.
            </p>

            {/* Search bar */}
            <form action="/facilities" method="GET" className="max-w-2xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-3 bg-surface border border-border rounded-dome p-2">
                <select
                  name="sport"
                  className="flex-1 bg-transparent text-white text-sm px-3 py-2 focus:outline-none"
                  defaultValue=""
                >
                  <option value="">All Sports</option>
                  {SPORTS.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.emoji} {s.label}</option>
                  ))}
                </select>
                <div className="w-px bg-border hidden sm:block" />
                <select
                  name="city"
                  className="flex-1 bg-transparent text-white text-sm px-3 py-2 focus:outline-none"
                  defaultValue=""
                >
                  <option value="">All Cities</option>
                  {CITIES.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}, {c.province}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary-hover text-white font-bold px-6 py-2.5 rounded-[10px] transition-colors text-sm whitespace-nowrap"
                >
                  Find Courts →
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ── Sports grid ─────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-3">
            Every Sport. Every City.
          </h2>
          <p className="text-muted text-center mb-10">Browse facilities by sport.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {SPORTS.slice(0, 8).map((sport) => (
              <Link
                key={sport.slug}
                href={`/facilities?sport=${sport.slug}`}
                className="group bg-surface border border-border rounded-dome p-5 text-center hover:border-primary/50 hover:bg-surface-2 transition-all"
              >
                <span className="text-4xl block mb-3">{sport.emoji}</span>
                <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                  {sport.label}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section className="bg-surface border-y border-border py-20">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-3">How It Works</h2>
            <p className="text-muted text-center mb-12">Three steps to your next game.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((step) => (
                <div key={step.num} className="text-center">
                  <div className="text-5xl font-black text-primary/20 mb-4">{step.num}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Featured cities ─────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-2xl md:text-3xl font-black text-white text-center mb-3">
            Available in Your City
          </h2>
          <p className="text-muted text-center mb-10">Growing across Canada every week.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {CITIES.map((city) => (
              <Link
                key={city.name}
                href={`/facilities?city=${city.name}`}
                className="flex items-center gap-2 bg-surface border border-border rounded-full px-5 py-2.5 text-sm font-medium text-white hover:border-primary/50 hover:bg-surface-2 transition-colors"
              >
                <span>{city.emoji}</span>
                <span>{city.name}</span>
                <span className="text-muted text-xs">{city.province}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── CTA banner ──────────────────────────────────────────────────── */}
        <section className="bg-primary/5 border-y border-primary/20 py-16">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Ready to play?
            </h2>
            <p className="text-muted mb-8 max-w-md mx-auto">
              Join thousands of players booking courts across Canada.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/facilities" className="bg-primary hover:bg-primary-hover text-white font-bold px-8 py-3.5 rounded-dome transition-colors">
                Browse Facilities
              </Link>
              <Link href="/connect" className="bg-surface border border-border text-white font-semibold px-8 py-3.5 rounded-dome hover:border-primary/50 transition-colors">
                Join an Open Game
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
