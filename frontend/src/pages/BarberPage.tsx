import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApiError, changeQueueStatus, createStaffSession, getBarbers, getStaffQueue, setBarberBreak, type BarberOption, type StaffQueueEntry } from "../lib/api";
import { queueSocket } from "../lib/socket";

function token(value: number) { return "#" + String(value).padStart(3, "0"); }
export default function BarberPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [entries, setEntries] = useState<StaffQueueEntry[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [barberId, setBarberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [queue, roster] = await Promise.all([getStaffQueue(), getBarbers()]);
      setEntries(queue.entries); setBarbers(roster);
      setBarberId((old) => old && roster.some((item) => item.id === old) ? old : roster.find((item) => item.on_duty)?.id ?? "");
      setAuthenticated(true); setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuthenticated(false);
      else setError(err instanceof Error ? err.message : "Barber view could not be loaded.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!authenticated) return;
    const sync = () => { void refresh(); };
    queueSocket.on("queue:updated", sync); queueSocket.on("barbers:updated", sync); queueSocket.on("connect", sync);
    if (!queueSocket.active) queueSocket.connect();
    return () => { queueSocket.off("queue:updated", sync); queueSocket.off("barbers:updated", sync); queueSocket.off("connect", sync); queueSocket.disconnect(); };
  }, [authenticated, refresh]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    try { await createStaffSession(code); setCode(""); setAuthenticated(true); await refresh(); }
    catch (err) { setLoginError(err instanceof Error ? err.message : "Access could not be verified."); }
  }
  async function act(entry: StaffQueueEntry, next: "In chair" | "Done") {
    setPending(entry.id); setError(""); setNotice("");
    try { await changeQueueStatus(entry.id, next); setNotice(token(entry.token_number) + (next === "In chair" ? " service started." : " marked done.")); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Queue status could not be updated."); }
    finally { setPending(""); }
  }
  async function toggleBreak(onBreak: boolean) {
    if (!barberId) return;
    try { setError(""); const changed = await setBarberBreak(barberId, onBreak); setBarbers((old) => old.map((item) => item.id === changed.id ? changed : item)); }
    catch (err) { setError(err instanceof Error ? err.message : "Break status could not be updated."); }
  }

  if (loading && authenticated === null) return <p role="status" className="rounded-3xl border border-blush bg-white p-7">Checking staff session…</p>;
  if (!authenticated) return <section className="mx-auto max-w-lg"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Barber view</p><h1 className="mt-3 text-3xl font-semibold">Barber Workspace</h1><p className="mt-2 text-charcoal/70">Sign in with the existing staff access code.</p>
    <form className="mt-6 rounded-3xl border border-blush bg-white p-6" onSubmit={login}><label htmlFor="barber-code" className="mb-2 block text-sm font-medium">Staff access code</label><input id="barber-code" type="password" required className="min-h-12 w-full rounded-xl border border-charcoal/20 px-4" value={code} onChange={(e) => setCode(e.target.value)} />{loginError && <p role="alert" className="mt-3 text-sm text-red-700">{loginError}</p>}<button className="mt-5 min-h-12 w-full rounded-full bg-rosewood font-semibold text-white">Open Barber View</button></form>
  </section>;

  const barber = barbers.find((item) => item.id === barberId);
  const assigned = entries.filter((entry) => entry.assigned_barber_id === barberId && (entry.status === "Called" || entry.status === "In chair"));
  return <section className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Barber view</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Barber Workspace</h1><p className="mt-2 text-charcoal/65">View customers called for you and update service progress.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-900">{notice}</p>}
    <section className="rounded-3xl border border-blush bg-white p-5 sm:p-7">
      <label htmlFor="barber-select" className="block text-sm font-semibold">Select your barber profile</label>
      <select id="barber-select" className="mt-2 min-h-12 w-full rounded-xl border border-charcoal/20 bg-white px-4 sm:max-w-md" value={barberId} onChange={(e) => setBarberId(e.target.value)}><option value="">Choose barber</option>{barbers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.on_duty ? " ... On duty" : " ... Off duty"}</option>)}</select>
      {barber && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream p-4"><div><p className="font-semibold">{barber.name}</p><p className="text-sm text-charcoal/60">{barber.on_duty ? barber.on_break ? "On break" : "On duty" : "Off duty"}</p></div><button type="button" disabled={!barber.on_duty} onClick={() => void toggleBreak(!barber.on_break)} className="min-h-11 rounded-full border border-charcoal/20 px-5 font-semibold disabled:opacity-50">{barber.on_break ? "Return from break" : "Go on break"}</button></div>}
    </section>
    <section><h2 className="text-xl font-semibold">Your customers</h2>{!barberId ? <p className="mt-3 rounded-2xl bg-white p-5 text-sm">Choose your barber profile.</p> : assigned.length === 0 ? <p className="mt-3 rounded-2xl bg-white p-5 text-sm">No customers have been called for this barber.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{assigned.map((entry) => <article key={entry.id} className="rounded-3xl border border-blush bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><p className="text-4xl font-bold">{token(entry.token_number)}</p><span className="rounded-full bg-cream px-3 py-1 text-sm font-semibold">{entry.status}</span></div><h3 className="mt-4 text-xl font-semibold">{entry.customer_name}</h3><p className="mt-1 text-charcoal/65">{entry.service_name} ... {entry.service_duration_minutes} min</p>{entry.status === "Called" ? <button type="button" disabled={Boolean(pending) || Boolean(barber?.on_break)} onClick={() => void act(entry, "In chair")} className="mt-5 min-h-12 w-full rounded-full bg-rosewood font-semibold text-white disabled:opacity-50">{pending === entry.id ? "Updating…" : "Start service"}</button> : <button type="button" disabled={Boolean(pending)} onClick={() => void act(entry, "Done")} className="mt-5 min-h-12 w-full rounded-full bg-charcoal font-semibold text-white disabled:opacity-50">{pending === entry.id ? "Updating…" : "Mark Done"}</button>}</article>)}</div>}</section>
  </section>;
}
