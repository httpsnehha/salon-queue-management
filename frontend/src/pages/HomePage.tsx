import { useState } from "react";
import { Link } from "react-router-dom";

type Service = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  duration: number;
};

const services: Service[] = [
  { id: "signature-cut", name: "Signature Haircut", category: "Hair", description: "A consultation-led cut finished with a smooth, polished style.", price: "₹600", duration: 45 },
  { id: "nourishing-hair-spa", name: "Nourishing Hair Spa", category: "Hair", description: "A relaxing cleanse and conditioning ritual for softer, shinier hair.", price: "₹1,200", duration: 60 },
  { id: "radiance-facial", name: "Radiance Facial", category: "Skin", description: "A gentle facial treatment to leave your skin feeling refreshed.", price: "₹1,000", duration: 50 },
  { id: "classic-manicure", name: "Classic Manicure", category: "Nails", description: "Nail shaping, cuticle care, and a neat finishing polish.", price: "₹700", duration: 40 },
  { id: "relaxing-pedicure", name: "Relaxing Pedicure", category: "Nails", description: "A soothing foot soak followed by nail and skin care.", price: "₹900", duration: 50 },
  { id: "brow-threading", name: "Brow Threading", category: "Grooming", description: "Careful shaping for a clean, natural-looking finish.", price: "₹250", duration: 20 },
];

const categories = ["All", "Hair", "Skin", "Nails", "Grooming"];

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const visibleServices = services.filter((service) => {
    const matchesCategory = activeCategory === "All" || service.category === activeCategory;
    const searchText = (service.name + " " + service.description + " " + service.category).toLowerCase();
    return matchesCategory && searchText.includes(searchTerm.trim().toLowerCase());
  });

  return (
    <div className="space-y-16 sm:space-y-20">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#f0dcda] px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16">
        <div className="pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full border border-white/50 sm:right-8 sm:top-1/2 sm:h-[28rem] sm:w-[28rem] sm:-translate-y-1/2" />
        <div className="pointer-events-none absolute -right-12 -top-16 -z-10 h-60 w-60 rounded-full border border-white/40 sm:right-24 sm:top-1/2 sm:h-80 sm:w-80 sm:-translate-y-1/2" />
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-rosewood sm:text-sm">A little time for yourself</p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-charcoal sm:text-5xl lg:text-6xl">
              Welcome to <span className="font-serif italic text-rosewood">Maison Rose</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-charcoal/75 sm:text-lg">
              Find a service that feels right, then join the salon queue at your own pace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-charcoal px-7 py-3 text-center font-semibold text-white transition hover:bg-rosewood focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal" to="/join">
                Join Queue
              </Link>
              <a className="inline-flex min-h-12 items-center justify-center rounded-full border border-charcoal/20 bg-white/45 px-7 py-3 text-center font-semibold text-charcoal transition hover:bg-white/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charcoal" href="#services">
                Explore services
              </a>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-white/70 bg-cream/75 p-6 shadow-sm backdrop-blur-sm sm:p-8" aria-label="Sample waiting information">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-charcoal/65">Waiting at the salon</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-charcoal sm:text-6xl">4</p>
                <p className="mt-1 text-sm text-charcoal/65">customers in this sample</p>
              </div>
              <span className="mt-1 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blush text-xl text-rosewood" aria-hidden="true">✿</span>
            </div>
            <div className="mt-6 border-t border-charcoal/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rosewood">Sample data · Not live</p>
              <p className="mt-2 text-sm leading-6 text-charcoal/65">Queue updates will appear here when the backend queue is connected.</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="services" className="scroll-mt-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rosewood">Thoughtful salon care</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Explore our services</h2>
            <p className="mt-3 max-w-xl leading-6 text-charcoal/65">Browse a sample of salon services. Choose a category or search to find what you need.</p>
          </div>
          <label className="block w-full lg:max-w-sm">
            <span className="sr-only">Search services</span>
            <span className="flex min-h-12 items-center gap-3 rounded-full border border-charcoal/15 bg-white px-4 shadow-sm focus-within:border-rosewood">
              <svg className="h-5 w-5 shrink-0 text-charcoal/50" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" />
                <path d="m16 16 4.4 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input className="w-full border-0 bg-transparent py-2 text-sm text-charcoal outline-none placeholder:text-charcoal/45" type="search" placeholder="Search services" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2" aria-label="Filter services by category">
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "min-h-10 rounded-full bg-charcoal px-5 text-sm font-medium text-white" : "min-h-10 rounded-full border border-charcoal/15 bg-white px-5 text-sm font-medium text-charcoal/70 transition hover:border-rosewood hover:text-rosewood"}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {visibleServices.length > 0 ? (
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleServices.map((service, index) => (
              <article className="group flex min-h-72 flex-col rounded-3xl border border-blush/80 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md" key={service.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-rosewood">{service.category}</span>
                  <span className="text-xs text-charcoal/45">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{service.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-charcoal/65">{service.description}</p>
                <div className="mt-5 flex items-end justify-between border-t border-charcoal/10 pt-4">
                  <div><p className="text-xs text-charcoal/55">Sample price</p><p className="mt-1 text-lg font-semibold">{service.price}</p></div>
                  <p className="text-sm text-charcoal/65">{service.duration} min</p>
                </div>
                <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-rosewood/30 px-5 py-2 text-sm font-semibold text-rosewood transition hover:bg-rosewood hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosewood" to={"/join?service=" + encodeURIComponent(service.id)}>
                  Book / Join Queue
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-7 rounded-2xl border border-blush bg-white p-6 text-charcoal/70" role="status">
            No services available for this search. Try another term or category.
          </p>
        )}
      </section>
    </div>
  );
}