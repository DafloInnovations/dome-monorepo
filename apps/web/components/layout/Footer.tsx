import Link from "next/link";

const LINKS = {
  Product: [
    { href: "/facilities", label: "Find Facilities" },
    { href: "/connect",    label: "Connect Games" },
    { href: "/login",      label: "Sign In" },
  ],
  Company: [
    { href: "#", label: "About" },
    { href: "#", label: "Blog" },
    { href: "#", label: "Careers" },
  ],
  Support: [
    { href: "#", label: "Help Centre" },
    { href: "#", label: "Contact Us" },
    { href: "#", label: "For Vendors" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border mt-20">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-2xl font-black text-white tracking-tight">DOME</Link>
            <p className="text-sm text-muted mt-3 leading-relaxed">
              Play your sport everyday.<br />
              Book courts across Canada.
            </p>
            <div className="flex gap-3 mt-5">
              {["𝕏", "📘", "📷"].map((icon, i) => (
                <a key={i} href="#" className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center text-sm text-muted hover:text-white hover:border-primary/50 transition-colors">
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">{section}</p>
              <ul className="space-y-2.5">
                {items.map(({ label }) => (
                  <li key={label}>
                    <span className="text-sm text-muted cursor-default">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* App store badges */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted">© 2026 Dome Sports Inc. All rights reserved.</p>
          <div className="flex gap-3">
            {["App Store", "Google Play"].map((store) => (
              <span key={store} className="px-4 py-2 bg-surface-2 border border-border rounded-dome text-xs text-muted">
                {store} — Coming Soon
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
