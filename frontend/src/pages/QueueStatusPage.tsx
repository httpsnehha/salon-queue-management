import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRegistration, type QueueRegistration } from "../lib/api";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function QueueStatusPage() {
  const { id = "" } = useParams();
  const [registration, setRegistration] = useState<QueueRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRegistration = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRegistration(await getRegistration(id)); }
    catch (requestError) {
      setRegistration(null);
      setError(requestError instanceof Error ? requestError.message : "Queue details could not be loaded.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void loadRegistration(); }, [loadRegistration]);

  if (loading) return <section className="mx-auto max-w-2xl rounded-3xl border border-blush bg-white p-8 text-charcoal/70" role="status">Loading your queue details…</section>;
  if (error || !registration) return <section className="mx-auto max-w-2xl rounded-3xl border border-blush bg-white p-7 shadow-sm">
    <h1 className="text-2xl font-semibold">Queue details unavailable</h1><p className="mt-3 text-charcoal/70">{error || "This queue registration could not be found."}</p>
    <div className="mt-6 flex flex-wrap gap-3"><button className="min-h-11 rounded-full bg-rosewood px-5 py-2 font-semibold text-white" type="button" onClick={() => void loadRegistration()}>Try again</button><Link className="inline-flex min-h-11 items-center rounded-full border border-charcoal/20 px-5 py-2 font-semibold" to="/">Return home</Link></div>
  </section>;

  return <section className="mx-auto max-w-3xl">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Queue registration</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your queue status</h1>
    <div className="mt-7 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-9">
      <div className="flex flex-col justify-between gap-5 border-b border-charcoal/10 pb-6 sm:flex-row sm:items-center">
        <div><p className="text-sm text-charcoal/60">Your token</p><p className="mt-1 text-6xl font-semibold tracking-tight">#{String(registration.token_number).padStart(3, "0")}</p></div>
        <span className="inline-flex w-fit rounded-full bg-cream px-4 py-2 text-sm font-semibold text-rosewood">{registration.status}</span>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Customer</p><p className="mt-1 font-medium">{registration.customer_name}</p></div>
        <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Service</p><p className="mt-1 font-medium">{registration.service_name}</p></div>
        <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Price</p><p className="mt-1 font-medium">{formatPrice(registration.service_price)}</p></div>
        <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Estimated service duration</p><p className="mt-1 font-medium">{registration.service_duration_minutes} minutes</p></div>
        <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Registered</p><p className="mt-1 font-medium">{formatDate(registration.registered_at)}</p></div>
        {registration.status === "Waiting" && <>
          <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Queue position</p><p className="mt-1 font-medium">{registration.position ?? "—"}</p></div>
          <div><p className="text-xs uppercase tracking-[0.12em] text-charcoal/50">Approximate waiting time</p><p className="mt-1 font-medium">{registration.approximate_wait_minutes ?? 0} minutes</p></div>
        </>}
      </div>
      <p className="mt-7 rounded-2xl bg-cream p-4 text-sm leading-6 text-charcoal/70" role="status">
        {registration.status === "Completed" ? "Your service is complete. Thank you for visiting."
          : registration.status === "Waiting" ? "Your registration is confirmed. Your approximate waiting time may change as the queue moves."
          : registration.status === "Cancelled" ? "This queue registration is cancelled."
          : "Your service is in progress."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3"><button className="min-h-11 rounded-full border border-charcoal/20 px-5 py-2 font-semibold hover:bg-cream" type="button" onClick={() => void loadRegistration()}>Refresh status</button><Link className="inline-flex min-h-11 items-center rounded-full bg-rosewood px-5 py-2 font-semibold text-white hover:bg-charcoal" to="/">Return home</Link></div>
    </div>
  </section>;
}