import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createRegistration, getServices, type RegistrationConfirmation, type ServiceOption } from "../lib/api";

type FormErrors = { customerName?: string; phoneNumber?: string; serviceId?: string; form?: string };

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}
function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\+?[0-9().\s-]+$/.test(value.trim()) && digits.length >= 7 && digits.length <= 15;
}

export default function JoinQueuePage() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceLoadError, setServiceLoadError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [serviceId, setServiceId] = useState(searchParams.get("service") ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<RegistrationConfirmation | null>(null);
  const submissionStarted = useRef(false);

  useEffect(() => {
    let active = true;
    getServices().then((items) => {
      if (active) setServices(items);
    }).catch((error: unknown) => {
      if (active) setServiceLoadError(error instanceof Error ? error.message : "Services could not be loaded.");
    }).finally(() => {
      if (active) setLoadingServices(false);
    });
    return () => { active = false; };
  }, []);

  const selectedService = services.find((item) => item.id === serviceId);

  function validate(): FormErrors {
    const next: FormErrors = {};
    const name = customerName.trim();
    if (!name) next.customerName = "Enter your name.";
    else if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name) || !/\p{L}/u.test(name)) {
      next.customerName = "Enter a valid name between 2 and 100 characters.";
    }
    if (!phoneNumber.trim()) next.phoneNumber = "Enter your phone number.";
    else if (!isValidPhone(phoneNumber)) next.phoneNumber = "Enter a valid phone number with 7 to 15 digits.";
    if (!serviceId) next.serviceId = "Choose a service to join the queue.";
    else if (!selectedService) next.serviceId = "That service is unavailable. Choose an available service.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionStarted.current || loadingServices || serviceLoadError) return;
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    submissionStarted.current = true;
    setSubmitting(true);
    try {
      setConfirmation(await createRegistration({
        customerName: customerName.trim(), phoneNumber: phoneNumber.trim(), serviceId,
      }));
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "Registration could not be completed. Please try again." });
    } finally {
      submissionStarted.current = false;
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return <section className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Registration complete</p>
      <div className="mt-4 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cream text-2xl text-rosewood" aria-hidden="true">✓</div>
        <h1 className="mt-5 text-3xl font-semibold">You’re in the queue, {confirmation.customerName}.</h1>
        <p className="mt-3 text-charcoal/70">Your registration is confirmed. Please keep your token handy.</p>
        <div className="mt-7 rounded-2xl bg-cream p-5">
          <p className="text-sm text-charcoal/60">Your token</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight">{confirmation.token}</p>
          <p className="mt-4 font-medium">{confirmation.serviceName}</p>
          <p className="mt-1 text-sm text-charcoal/65">{formatPrice(confirmation.servicePrice)} · {confirmation.serviceDurationMinutes} minutes</p>
        </div>
        <Link className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-rosewood px-6 py-3 font-semibold text-white hover:bg-charcoal" to={"/queue/" + confirmation.id}>View your queue status</Link>
      </div>
    </section>;
  }

  return <section className="mx-auto max-w-2xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Customer registration</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Join the queue</h1>
    <p className="mt-2 text-charcoal/70">Choose a service and add your details to receive a queue token.</p>
    <form className="mt-7 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-8" onSubmit={handleSubmit} noValidate>
      {errors.form && <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{errors.form}</p>}
      {serviceLoadError && <p className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{serviceLoadError}</p>}
      {!loadingServices && !serviceLoadError && services.length === 0 && <p className="mb-5 rounded-xl bg-cream p-3 text-sm text-charcoal/75" role="status">No services available. Please return later.</p>}
      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="customer-name">Customer name</label>
          <input className="min-h-12 w-full rounded-xl border border-charcoal/20 px-4 outline-none focus:border-rosewood focus:ring-2 focus:ring-blush" id="customer-name" autoComplete="name" maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "customer-name-error" : undefined} />
          {errors.customerName && <p className="mt-2 text-sm text-red-700" id="customer-name-error">{errors.customerName}</p>}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="phone-number">Phone number</label>
          <input className="min-h-12 w-full rounded-xl border border-charcoal/20 px-4 outline-none focus:border-rosewood focus:ring-2 focus:ring-blush" id="phone-number" type="tel" autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} aria-invalid={Boolean(errors.phoneNumber)} aria-describedby={errors.phoneNumber ? "phone-number-error" : undefined} />
          {errors.phoneNumber && <p className="mt-2 text-sm text-red-700" id="phone-number-error">{errors.phoneNumber}</p>}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium" htmlFor="service">Select a service</label>
          <select className="min-h-12 w-full rounded-xl border border-charcoal/20 bg-white px-4 outline-none focus:border-rosewood focus:ring-2 focus:ring-blush" id="service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={loadingServices || Boolean(serviceLoadError)} aria-invalid={Boolean(errors.serviceId)} aria-describedby={errors.serviceId ? "service-error" : undefined}>
            <option value="">{loadingServices ? "Loading services…" : "Choose a service"}</option>
            {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
          {errors.serviceId && <p className="mt-2 text-sm text-red-700" id="service-error">{errors.serviceId}</p>}
        </div>
        {selectedService && <div className="rounded-2xl bg-cream p-5" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rosewood">Selected service</p>
          <div className="mt-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div><p className="font-semibold">{selectedService.name}</p><p className="mt-1 text-sm text-charcoal/65">{selectedService.description}</p></div>
            <p className="shrink-0 text-sm font-medium">{formatPrice(selectedService.price)} · {selectedService.duration_minutes} min</p>
          </div>
        </div>}
      </div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link className="inline-flex min-h-12 items-center justify-center rounded-full border border-charcoal/20 px-6 py-3 font-semibold text-charcoal hover:bg-cream" to="/">Back to services</Link>
        <button className="inline-flex min-h-12 items-center justify-center rounded-full bg-rosewood px-6 py-3 font-semibold text-white transition hover:bg-charcoal disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={submitting || loadingServices || Boolean(serviceLoadError) || services.length === 0}>
          {submitting ? "Registering…" : "Register / Join Queue"}
        </button>
      </div>
    </form>
  </section>;
}