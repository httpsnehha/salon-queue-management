import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { queueSocket } from "../lib/socket";
import { getPublicSettings, getServices, type PublicSettings, type ServiceOption } from "../lib/api";
import { LanguageToggle, customerText, useCustomerLanguage } from "../components/CustomerLanguage";

function price(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function HomePage() {
  const { language } = useCustomerLanguage();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let current = true;
    Promise.all([getServices(), getPublicSettings()]).then(([serviceItems, publicSettings]) => {
      if (current) { setServices(serviceItems); setSettings(publicSettings); }
    }).catch((requestError: unknown) => {
      if (current) setError(requestError instanceof Error ? requestError.message : "Salon information could not be loaded.");
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void Promise.all([getServices(), getPublicSettings()]).then(([serviceItems, publicSettings]) => {
        if (active) { setServices(serviceItems); setSettings(publicSettings); }
      }).catch(() => { /* Keep the last successful public view during a temporary disconnect. */ });
    };
    queueSocket.on("queue:updated", refresh); queueSocket.on("settings:updated", refresh); queueSocket.on("services:updated", refresh); queueSocket.on("connect", refresh);
    if (!queueSocket.active) queueSocket.connect();
    return () => { active = false; queueSocket.off("queue:updated", refresh); queueSocket.off("settings:updated", refresh); queueSocket.off("services:updated", refresh); queueSocket.off("connect", refresh); queueSocket.disconnect(); };
  }, []);

  const categories = useMemo(() => ["All", ...new Set(services.map((service) => service.category))], [services]);
  const visibleServices = services.filter((service) => {
    const search = (service.name + " " + service.name_gu + " " + service.description + " " + service.category).toLowerCase();
    return (category === "All" || service.category === category) && search.includes(searchTerm.trim().toLowerCase());
  });
  const queueOpen = settings?.onlineQueueOpen === true;

  return <div className="space-y-12 sm:space-y-16">
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#f0dcda] px-6 py-9 sm:px-10 sm:py-12 lg:px-16 lg:py-14">
      <div className="pointer-events-none absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full border border-white/50 sm:right-8 sm:top-1/2 sm:h-[28rem] sm:w-[28rem] sm:-translate-y-1/2" />
      <div className="absolute right-5 top-5"><LanguageToggle /></div>
      <div className="grid items-center gap-8 pt-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-rosewood sm:text-sm">{customerText(language, "A little time for yourself", "તમારા માટે થોડો સમય")}</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {customerText(language, "Welcome to", "આપનું સ્વાગત છે")} <span className="font-serif italic text-rosewood">Maison Rose</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-charcoal/75 sm:text-lg">{customerText(language, "Choose a salon service and join the queue when online joining is open.", "સલૂન સેવા પસંદ કરો અને ઑનલાઇન કતાર ખુલ્લી હોય ત્યારે જોડાઓ.")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {queueOpen
              ? <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-charcoal px-7 py-3 font-semibold text-white hover:bg-rosewood" to="/join">{customerText(language, "Join Queue", "કતારમાં જોડાઓ")}</Link>
              : <button disabled className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-charcoal/50 px-7 py-3 font-semibold text-white">{customerText(language, "Online Queue Closed", "ઑનલાઇન કતાર બંધ છે")}</button>}
            <a className="inline-flex min-h-12 items-center justify-center rounded-full border border-charcoal/20 bg-white/45 px-7 py-3 font-semibold text-charcoal hover:bg-white/75" href="#services">{customerText(language, "Explore services", "સેવાઓ જુઓ")}</a>
          </div>
        </div>
        <aside className="rounded-[1.75rem] border border-white/70 bg-cream/80 p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium text-charcoal/65">{customerText(language, "Customers waiting", "રાહ જોતા ગ્રાહકો")}</p><p className="mt-2 text-5xl font-semibold sm:text-6xl">{settings?.waitingCount ?? "..."}</p></div>
            <span className={"rounded-full px-4 py-2 text-sm font-semibold " + (queueOpen ? "bg-green-100 text-green-900" : "bg-charcoal/10 text-charcoal/70")}>{queueOpen ? customerText(language, "Online queue open", "ઑનલાઇન કતાર ખુલ્લી છે") : customerText(language, "Online queue closed", "ઑનલાઇન કતાર બંધ છે")}</span>
          </div>
          {!queueOpen && <p className="mt-5 border-t border-charcoal/10 pt-4 text-sm leading-6 text-charcoal/70">{customerText(language, "Online registration is currently closed. Please contact the salon or visit in person.", "ઑનલાઇન નોંધણી હાલમાં બંધ છે. કૃપા કરીને સલૂનનો સંપર્ક કરો અથવા રૂબરૂ આવો.")}</p>}
        </aside>
      </div>
    </section>

    <section id="services" className="scroll-mt-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-rosewood">{customerText(language, "Thoughtful salon care", "સલૂનની સંભાળ")}</p><h2 className="mt-2 text-3xl font-semibold sm:text-4xl">{customerText(language, "Explore our services", "અમારી સેવાઓ")}</h2></div>
        <label className="block w-full lg:max-w-sm"><span className="sr-only">Search services</span><input className="min-h-12 w-full rounded-full border border-charcoal/15 bg-white px-5 shadow-sm" type="search" placeholder={customerText(language, "Search services", "સેવાઓ શોધો")} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2" aria-label="Filter services by category">
        {categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={"min-h-10 rounded-full px-5 text-sm font-medium " + (category === item ? "bg-charcoal text-white" : "border border-charcoal/15 bg-white text-charcoal/70")}>{item}</button>)}
      </div>
      {loading ? <p className="mt-7 rounded-2xl border border-blush bg-white p-6" role="status">Loading services...</p>
        : error ? <p className="mt-7 rounded-2xl bg-red-50 p-6 text-red-800" role="alert">{error}</p>
        : services.length === 0 ? <p className="mt-7 rounded-2xl border border-blush bg-white p-6" role="status">No services available.</p>
        : visibleServices.length === 0 ? <p className="mt-7 rounded-2xl border border-blush bg-white p-6" role="status">No services match your search.</p>
        : <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleServices.map((service) => <article key={service.id} className="flex min-h-64 flex-col rounded-3xl border border-blush/80 bg-white p-6 shadow-sm">
            <span className="w-fit rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rosewood">{service.category}</span>
            <h3 className="mt-4 text-xl font-semibold">{language === "gu" ? service.name_gu || service.name : service.name}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-charcoal/65">{service.description}</p>
            <div className="mt-4 flex items-end justify-between border-t border-charcoal/10 pt-4"><p className="text-lg font-semibold">{price(service.price)}</p><p className="text-sm text-charcoal/65">{service.duration_minutes} min</p></div>
            {queueOpen
              ? <Link className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-rosewood/30 px-5 text-sm font-semibold text-rosewood hover:bg-rosewood hover:text-white" to={"/join?service=" + encodeURIComponent(service.id)}>{customerText(language, "Book / Join Queue", "બુક કરો / કતારમાં જોડાઓ")}</Link>
              : <button disabled className="mt-4 min-h-11 cursor-not-allowed rounded-full border border-charcoal/15 px-5 text-sm font-semibold text-charcoal/45">{customerText(language, "Online joining closed", "ઑનલાઇન કતાર બંધ")}</button>}
          </article>)}
        </div>}
    </section>
  </div>;
}
