import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, callNextForBarber, changeQueueStatus, createStaffSession, createWalkIn, endStaffSession, getBarbers, getServices, getStaffQueue, getQueueHistory, type QueueHistoryEntry, type BarberOption, type QueueStatus, type ServiceOption, type StaffQueueEntry } from "../lib/api";
import { queueSocket } from "../lib/socket";

const sections: QueueStatus[] = ["Waiting", "Called", "In chair", "Done", "Cancelled", "No-show"];
function token(value: number) { return "#" + String(value).padStart(3, "0"); }
function time(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function StaffPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [entries, setEntries] = useState<StaffQueueEntry[]>([]);
  const [history, setHistory] = useState<QueueHistoryEntry[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [preferredBarberId, setPreferredBarberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(new Set<string>());
  const requestVersion = useRef(0);

  const loadQueue = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [queue, barberItems, serviceItems, past] = await Promise.all([getStaffQueue(), getBarbers(), getServices(), getQueueHistory()]);
      if (version !== requestVersion.current) return;
      setEntries(queue.entries); setHistory(past.entries); setBarbers(barberItems); setServices(serviceItems); setAuthenticated(true); setError("");
      if (!serviceId && serviceItems.length) setServiceId(serviceItems[0].id);
    } catch (err) {
      if (version !== requestVersion.current) return;
      if (err instanceof ApiError && err.status === 401) { setAuthenticated(false); setEntries([]); setHistory([]); }
      else setError(err instanceof Error ? err.message : "Queue could not be loaded.");
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [serviceId]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);
  useEffect(() => {
    if (!authenticated) return;
    const sync = () => { void loadQueue(); };
    queueSocket.on("queue:updated", sync); queueSocket.on("barbers:updated", sync); queueSocket.on("services:updated", sync); queueSocket.on("connect", sync);
    if (!queueSocket.active) queueSocket.connect();
    return () => { queueSocket.off("queue:updated", sync); queueSocket.off("barbers:updated", sync); queueSocket.off("services:updated", sync); queueSocket.off("connect", sync); queueSocket.disconnect(); };
  }, [authenticated, loadQueue]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    try { await createStaffSession(accessCode); setAccessCode(""); setAuthenticated(true); await loadQueue(); }
    catch (err) { setLoginError(err instanceof Error ? err.message : "Access could not be verified."); }
  }
  async function logout() {
    try { await endStaffSession(); setAuthenticated(false); setEntries([]); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not sign out."); }
  }
  async function status(entry: StaffQueueEntry, next: QueueStatus) {
    if (busy.current.size) return;
    busy.current.add(entry.id); setPending(entry.id); setError(""); setNotice("");
    try { await changeQueueStatus(entry.id, next); setNotice(token(entry.token_number) + " moved to " + next + "."); await loadQueue(); }
    catch (err) { setError(err instanceof Error ? err.message : "Queue status could not be updated."); }
    finally { busy.current.delete(entry.id); setPending(""); }
  }
  async function callNext(barber: BarberOption) {
    setPending(barber.id); setError(""); setNotice("");
    try { const result = await callNextForBarber(barber.id); setNotice(token(result.token_number) + " called for " + barber.name + "."); await loadQueue(); }
    catch (err) { setError(err instanceof Error ? err.message : "Next customer could not be called."); }
    finally { setPending(""); }
  }
  async function walkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending("walk-in"); setError(""); setNotice("");
    try {
      const result = await createWalkIn({ customerName: name, phoneNumber: phone, serviceId, preferredBarberId: preferredBarberId || null });
      setNotice("Walk-in registered with token " + result.token + "."); setName(""); setPhone(""); setPreferredBarberId(""); await loadQueue();
    } catch (err) { setError(err instanceof Error ? err.message : "Walk-in registration could not be completed."); }
    finally { setPending(""); }
  }

  if (loading && authenticated === null) return <p role="status" className="rounded-3xl border border-blush bg-white p-7">Checking staff session...</p>;
  if (!authenticated) return <section className="mx-auto max-w-lg"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Reception</p><h1 className="mt-3 text-3xl font-semibold">Reception Queue</h1>
    <form className="mt-6 rounded-3xl border border-blush bg-white p-6 shadow-sm" onSubmit={login}><label htmlFor="staff-code" className="mb-2 block text-sm font-medium">Staff access code</label><input id="staff-code" type="password" required autoComplete="current-password" className="min-h-12 w-full rounded-xl border border-charcoal/20 px-4" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />{loginError && <p role="alert" className="mt-3 text-sm text-red-700">{loginError}</p>}<button className="mt-5 min-h-12 w-full rounded-full bg-rosewood font-semibold text-white">Open reception</button></form>
  </section>;

  return <section>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Reception</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Queue Dashboard</h1><p className="mt-2 text-charcoal/65">Customers remain in token order. Calls expire to No-show after 10 minutes.</p></div><div className="flex gap-2"><button className="min-h-11 rounded-full border px-5 font-semibold" onClick={() => void loadQueue()}>Refresh</button><button className="min-h-11 rounded-full border px-5 font-semibold" onClick={() => void logout()}>Sign out</button></div></header>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">{notice}</p>}

    <section className="mt-7 rounded-3xl border border-blush bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Barbers on duty</h2>{barbers.filter((b) => b.on_duty).length === 0 ? <p className="mt-3 rounded-xl bg-cream p-4 text-sm">No barbers are on duty today. Set availability in Owner Settings.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{barbers.filter((b) => b.on_duty).map((barber) => <article key={barber.id} className="flex items-center justify-between gap-3 rounded-2xl border border-charcoal/10 p-4"><div><h3 className="font-semibold">{barber.name}</h3><p className="mt-1 text-xs text-charcoal/60">{barber.on_break ? "On break" : "Available"} ... {entries.some((e) => e.assigned_barber_id === barber.id && e.status === "In chair") ? "Serving a customer" : "Ready for a call"}</p></div><button type="button" disabled={pending !== "" || Boolean(barber.on_break) || entries.some((e) => e.assigned_barber_id === barber.id && e.status === "In chair")} onClick={() => void callNext(barber)} className="min-h-10 rounded-full bg-rosewood px-4 text-sm font-semibold text-white disabled:opacity-45">{pending === barber.id ? "Calling..." : "Call Next"}</button></article>)}</div>}</section>

    <form onSubmit={walkIn} className="mt-5 rounded-3xl border border-blush bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Register walk-in</h2><p className="mt-1 text-sm text-charcoal/65">Staff walk-ins are accepted even when online joining is closed.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-medium">Customer name<input required maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="text-sm font-medium">Phone<input required type="tel" className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="text-sm font-medium">Service<select required className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 bg-white px-3" value={serviceId} onChange={(e) => setServiceId(e.target.value)}><option value="">Choose service</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-sm font-medium">Barber preference<select className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 bg-white px-3" value={preferredBarberId} onChange={(e) => setPreferredBarberId(e.target.value)}><option value="">Any available barber</option>{barbers.filter((b) => b.on_duty && !b.on_break).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    </div><button disabled={pending !== "" || !services.length} className="mt-4 min-h-11 rounded-full bg-charcoal px-6 font-semibold text-white disabled:opacity-50">{pending === "walk-in" ? "Registering..." : "Register walk-in"}</button></form>

    <div className="mt-7 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{sections.map((section) => {
      const list = entries.filter((entry) => entry.status === section);
      return <section key={section} className="min-w-0 rounded-3xl border border-blush bg-[#fffdfa] p-4 sm:p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{section}</h2><span className="rounded-full bg-cream px-3 py-1 text-sm">{list.length}</span></div>
        {!list.length ? <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-charcoal/60">{section === "Waiting" ? "No customers waiting." : "No records in this section."}</p> : <div className="mt-4 space-y-3">{list.map((entry) => <article key={entry.id} className="rounded-2xl border border-charcoal/10 bg-white p-4"><div className="flex items-start justify-between gap-2"><p className="text-2xl font-semibold">{token(entry.token_number)}</p><span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold">{entry.status}</span></div><h3 className="mt-3 font-semibold">{entry.customer_name}</h3><p className="mt-1 text-sm text-charcoal/70">{entry.service_name} ... {entry.service_duration_minutes} min</p><p className="mt-2 text-xs text-charcoal/55">Registered {time(entry.registered_at)}{entry.assigned_barber_name ? " ... " + entry.assigned_barber_name : ""}</p>
          {section === "Waiting" && <button type="button" disabled={Boolean(pending)} onClick={() => void status(entry, "Cancelled")} className="mt-3 min-h-10 rounded-full border border-charcoal/20 px-4 text-sm font-semibold disabled:opacity-50">Cancel</button>}
          {section === "Called" && <p className="mt-3 text-xs text-charcoal/60">Called at {entry.called_at ? time(entry.called_at) : "..."} ... marked No-show automatically after 10 minutes.</p>}
          {section === "In chair" && <button type="button" disabled={Boolean(pending)} onClick={() => void status(entry, "Done")} className="mt-3 min-h-10 rounded-full bg-charcoal px-4 text-sm font-semibold text-white disabled:opacity-50">Mark Done</button>}
          {(section === "Cancelled" || section === "No-show") && <p className="mt-3 border-t pt-3 text-xs text-charcoal/55">Historical record retained. Token will not be reused.</p>}
        </article>)}</div>}
      </section>;
    })}</div>
    <section className="mt-7 rounded-3xl border border-blush bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Earlier cancelled and no-show records</h2>{history.length === 0 ? <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-charcoal/60">No earlier cancelled or no-show records.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{history.map((entry) => <article key={entry.id} className="rounded-2xl border border-charcoal/10 p-4"><div className="flex items-center justify-between gap-2"><p className="text-2xl font-semibold">{token(entry.token_number)}</p><span className="rounded-full bg-cream px-3 py-1 text-xs">{entry.status} ? {entry.token_date}</span></div><h3 className="mt-3 font-semibold">{entry.customer_name}</h3><p className="mt-1 text-sm text-charcoal/70">{entry.service_name} ? {entry.service_duration_minutes} min</p><p className="mt-2 text-xs text-charcoal/55">Registered {time(entry.registered_at)}</p></article>)}</div>}</section>
  </section>;
}
