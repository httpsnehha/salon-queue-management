import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createRegistration, getPublicSettings, getServices, type BarberOption, type PublicSettings, type RegistrationConfirmation, type ServiceOption } from "../lib/api";
import { queueSocket } from "../lib/socket";
import { LanguageToggle, useCustomerLanguage } from "../components/CustomerLanguage";

type FormErrors = { customerName?: string; phoneNumber?: string; serviceId?: string; barberId?: string; form?: string };
function text(gu: boolean, en: string, translated: string) { return gu ? translated : en; }
function price(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\+?[0-9().\s-]+$/.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
}

export default function JoinQueuePage() {
  const [params] = useSearchParams();
  const { language } = useCustomerLanguage();
  const gu = language === "gu";
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(params.get("service") ?? "");
  const [barberId, setBarberId] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<RegistrationConfirmation | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([getServices(), getPublicSettings()]).then(([availableServices, publicSettings]) => {
      if (!active) return;
      setServices(availableServices);
      setSettings(publicSettings);
      setBarbers(publicSettings.barbers);
    }).catch((err: unknown) => {
      if (active) setLoadError(err instanceof Error ? err.message : "Salon information could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void Promise.all([getServices(), getPublicSettings()]).then(([availableServices, publicSettings]) => {
        if (!active) return;
        setServices(availableServices); setSettings(publicSettings); setBarbers(publicSettings.barbers);
      }).catch(() => { /* Submission remains protected by backend validation. */ });
    };
    queueSocket.on("settings:updated", refresh); queueSocket.on("services:updated", refresh); queueSocket.on("barbers:updated", refresh); queueSocket.on("connect", refresh);
    if (!queueSocket.active) queueSocket.connect();
    return () => { active = false; queueSocket.off("settings:updated", refresh); queueSocket.off("services:updated", refresh); queueSocket.off("barbers:updated", refresh); queueSocket.off("connect", refresh); queueSocket.disconnect(); };
  }, []);

  const selectedService = services.find((service) => service.id === serviceId);
  const chosenBarber = barbers.find((barber) => barber.id === barberId);

  function validate(): FormErrors {
    const result: FormErrors = {};
    const cleanName = name.trim();
    if (!cleanName) result.customerName = text(gu, "Enter your name.", "તમારું નામ લખો.");
    else if (cleanName.length < 2 || cleanName.length > 100 || /[\u0000-\u001f\u007f]/.test(cleanName) || !/\p{L}/u.test(cleanName)) result.customerName = text(gu, "Enter a valid name.", "યોગ્ય નામ લખો.");
    if (!phone.trim()) result.phoneNumber = text(gu, "Enter your phone number.", "તમારો ફોન નંબર લખો.");
    else if (!validPhone(phone)) result.phoneNumber = text(gu, "Enter a valid phone number with 7 to 15 digits.", "7 થી 15 અંકનો યોગ્ય ફોન નંબર લખો.");
    if (!serviceId || !selectedService) result.serviceId = text(gu, "Choose an available service.", "ઉપલબ્ધ સેવા પસંદ કરો.");
    if (chosenBarber?.on_break) result.barberId = text(gu, "That barber is on break. Choose another barber or Any available barber.", "આ વાળંદ વિરામ પર છે. બીજો વાળંદ અથવા કોઈપણ ઉપલબ્ધ વાળંદ પસંદ કરો.");
    return result;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || loading) return;
    if (!settings?.onlineQueueOpen) { setErrors({ form: text(gu, "Online joining is closed. Please contact the salon or visit in person.", "ઑનલાઇન નોંધણી બંધ છે. કૃપા કરીને સલૂનનો સંપર્ક કરો અથવા રૂબરૂ આવો.") }); return; }
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length) return;
    inFlight.current = true; setSubmitting(true);
    try {
      setConfirmation(await createRegistration({ customerName: name.trim(), phoneNumber: phone.trim(), serviceId, preferredBarberId: barberId || null }));
    } catch (err) { setErrors({ form: err instanceof Error ? err.message : "Registration could not be completed." }); }
    finally { inFlight.current = false; setSubmitting(false); }
  }

  if (confirmation) {
    const label = chosenBarber?.name;
    return <section className="mx-auto max-w-2xl"><div className="flex items-center justify-between"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">{text(gu, "Registration complete", "નોંધણી પૂર્ણ")}</p><LanguageToggle /></div>
      <div className="mt-4 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-9"><h1 className="text-3xl font-semibold">{text(gu, "You’re in the queue", "તમે કતારમાં જોડાયા છો")}, {confirmation.customerName}.</h1>
        <div className="mt-6 rounded-2xl bg-cream p-5"><p className="text-sm text-charcoal/60">{text(gu, "Your token", "તમારો ટોકન")}</p><p className="mt-1 text-5xl font-semibold">{confirmation.token}</p><p className="mt-4 font-medium">{gu ? confirmation.serviceNameGujarati : confirmation.serviceName}</p><p className="mt-1 text-sm text-charcoal/65">{price(confirmation.servicePrice)} ... {confirmation.serviceDurationMinutes} min</p>{label && <p className="mt-3 text-sm">{text(gu, "Preferred barber", "પસંદ કરેલ વાળંદ")}: {label}</p>}</div>
        <Link className="mt-7 inline-flex min-h-12 items-center rounded-full bg-rosewood px-6 py-3 font-semibold text-white" to={"/queue/" + encodeURIComponent(confirmation.id)}>{text(gu, "View queue status", "કતારની સ્થિતિ જુઓ")}</Link>
      </div>
    </section>;
  }

  return <section className="mx-auto max-w-2xl">
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">{text(gu, "Customer registration", "ગ્રાહક નોંધણી")}</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{text(gu, "Join the queue", "કતારમાં જોડાઓ")}</h1><p className="mt-2 text-charcoal/70">{text(gu, "Choose a service, barber preference, and add your details.", "સેવા અને વાળંદ પસંદ કરી તમારી વિગતો આપો.")}</p></div><LanguageToggle /></div>
    {settings && !settings.onlineQueueOpen && <p role="status" className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{text(gu, "Online queue joining is closed. Please contact the salon or visit in person. Staff can still register walk-ins.", "ઑનલાઇન કતાર નોંધણી બંધ છે. કૃપા કરીને સલૂનનો સંપર્ક કરો અથવા રૂબરૂ આવો. સ્ટાફ વૉક-ઇન નોંધણી કરી શકે છે.")}</p>}
    {loadError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
    <form className="mt-6 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-8" onSubmit={submit} noValidate>
      {errors.form && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{errors.form}</p>}
      {loading ? <p role="status" className="mb-5 text-sm">Loading services…</p> : services.length === 0 && <p role="status" className="mb-5 rounded-xl bg-cream p-3 text-sm">No services available.</p>}
      <div className="space-y-5">
        <label className="block text-sm font-medium">{text(gu, "Customer name", "ગ્રાહકનું નામ")}<input autoComplete="name" maxLength={100} className="mt-2 min-h-12 w-full rounded-xl border border-charcoal/20 px-4" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.customerName)} />{errors.customerName && <span className="mt-1 block text-red-700">{errors.customerName}</span>}</label>
        <label className="block text-sm font-medium">{text(gu, "Phone number", "ફોન નંબર")}<input type="tel" autoComplete="tel" maxLength={24} className="mt-2 min-h-12 w-full rounded-xl border border-charcoal/20 px-4" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={Boolean(errors.phoneNumber)} />{errors.phoneNumber && <span className="mt-1 block text-red-700">{errors.phoneNumber}</span>}</label>
        <label className="block text-sm font-medium">{text(gu, "Select a service", "સેવા પસંદ કરો")}<select className="mt-2 min-h-12 w-full rounded-xl border border-charcoal/20 bg-white px-4" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={loading || Boolean(loadError)}><option value="">{text(gu, "Choose a service", "સેવા પસંદ કરો")}</option>{services.map((service) => <option key={service.id} value={service.id}>{gu ? service.name_gu : service.name}</option>)}</select>{errors.serviceId && <span className="mt-1 block text-red-700">{errors.serviceId}</span>}</label>
        <label className="block text-sm font-medium">{text(gu, "Preferred barber", "પસંદગીનો વાળંદ")}<select className="mt-2 min-h-12 w-full rounded-xl border border-charcoal/20 bg-white px-4" value={barberId} onChange={(e) => setBarberId(e.target.value)}><option value="">{text(gu, "Any available barber", "કોઈપણ ઉપલબ્ધ વાળંદ")}</option>{barbers.map((barber) => <option key={barber.id} value={barber.id} disabled={!barber.on_duty || Boolean(barber.on_break)}>{barber.name}{!barber.on_duty ? " (Off duty)" : barber.on_break ? " (On break)" : ""}</option>)}</select>{errors.barberId && <span className="mt-1 block text-red-700">{errors.barberId}</span>}{chosenBarber?.on_break && <span className="mt-1 block text-amber-800">{text(gu, "This barber is on break. Choose another barber or Any.", "આ વાળંદ વિરામ પર છે. બીજો અથવા કોઈપણ વાળંદ પસંદ કરો.")}</span>}</label>
        {selectedService && <div className="rounded-2xl bg-cream p-5"><p className="text-xs font-semibold uppercase text-rosewood">{text(gu, "Selected service", "પસંદ કરેલી સેવા")}</p><p className="mt-2 font-semibold">{gu ? selectedService.name_gu : selectedService.name}</p><p className="mt-1 text-sm text-charcoal/65">{selectedService.description}</p><p className="mt-2 text-sm font-medium">{price(selectedService.price)} ... {selectedService.duration_minutes} min</p></div>}
      </div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-charcoal/20 px-6 font-semibold" to="/">{text(gu, "Back to services", "સેવાઓ પર પાછા જાઓ")}</Link><button className="min-h-12 rounded-full bg-rosewood px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting || loading || !settings?.onlineQueueOpen || services.length === 0}>{submitting ? text(gu, "Registering…", "નોંધણી થઈ રહી છે…") : text(gu, "Register / Join Queue", "નોંધણી કરો / કતારમાં જોડાઓ")}</button></div>
    </form>
  </section>;
}
