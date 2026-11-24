import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ApiError, createBarber, createStaffSession, getBarbers, getOwnerServices, getQueueSettings,
  getQueueStatistics, saveService, setBarberBreak, setBarberDuty, setOnlineQueueOpen, setServiceActive,
  type BarberOption, type QueueSettings, type QueueStatistics, type ServiceOption,
} from "../lib/api";
import { queueSocket } from "../lib/socket";

type ServiceForm = { name: string; name_gu: string; category: string; description: string; price: string; duration_minutes: string };
const blankService: ServiceForm = { name: "", name_gu: "", category: "Hair", description: "", price: "", duration_minutes: "" };
function price(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [settings, setSettings] = useState<QueueSettings | null>(null);
  const [stats, setStats] = useState<QueueStatistics | null>(null);
  const [form, setForm] = useState<ServiceForm>(blankService);
  const [editId, setEditId] = useState("");
  const [barberName, setBarberName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    try {
      const results = await Promise.all([getOwnerServices(), getBarbers(), getQueueSettings(), getQueueStatistics()]);
      setServices(results[0]); setBarbers(results[1]); setSettings(results[2]); setStats(results[3]);
      setAuthenticated(true); setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAuthenticated(false);
      else setError(err instanceof Error ? err.message : "Owner settings could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!authenticated) return;
    const sync = () => { void reload(); };
    for (const event of ["queue:updated", "services:updated", "settings:updated", "barbers:updated", "connect"]) queueSocket.on(event, sync);
    if (!queueSocket.active) queueSocket.connect();
    return () => {
      for (const event of ["queue:updated", "services:updated", "settings:updated", "barbers:updated", "connect"]) queueSocket.off(event, sync);
      queueSocket.disconnect();
    };
  }, [authenticated, reload]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginError("");
    try { await createStaffSession(accessCode); setAccessCode(""); setAuthenticated(true); await reload(); }
    catch (err) { setLoginError(err instanceof Error ? err.message : "Staff access could not be verified."); }
  }
  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await saveService({
        name: form.name, name_gu: form.name_gu, category: form.category, description: form.description,
        price: Number(form.price), duration_minutes: Number(form.duration_minutes),
      }, editId || undefined);
      setForm(blankService); setEditId(""); setNotice(editId ? "Service updated." : "Service added."); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Service could not be saved."); }
    finally { setSaving(false); }
  }
  function edit(service: ServiceOption) {
    setEditId(service.id);
    setForm({ name: service.name, name_gu: service.name_gu, category: service.category, description: service.description, price: String(service.price), duration_minutes: String(service.duration_minutes) });
  }
  async function toggleService(service: ServiceOption) {
    setSaving(true); setError("");
    try { await setServiceActive(service.id, service.is_active !== 1); setNotice(service.name + (service.is_active ? " is off for new registrations." : " is available to customers.")); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Service availability could not be changed."); }
    finally { setSaving(false); }
  }
  async function addBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try { await createBarber(barberName); setBarberName(""); setNotice("Barber added to the roster."); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Barber could not be added."); }
    finally { setSaving(false); }
  }
  async function toggleDuty(barber: BarberOption) {
    setError(""); setNotice(""); setSaving(true);
    try { await setBarberDuty(barber.id, barber.on_duty !== 1); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Barber availability could not be changed."); }
    finally { setSaving(false); }
  }
  async function toggleBreak(barber: BarberOption) {
    setError(""); setNotice(""); setSaving(true);
    try { await setBarberBreak(barber.id, barber.on_break !== 1); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Barber break status could not be changed."); }
    finally { setSaving(false); }
  }
  async function changeQueue(open: boolean) {
    if (!settings) return;
    try { setSettings({ onlineQueueOpen: open }); await setOnlineQueueOpen(open); setNotice(open ? "Online joining is open." : "Online joining is closed. Staff can still register walk-ins."); }
    catch (err) { setSettings({ onlineQueueOpen: !open }); setError(err instanceof Error ? err.message : "Queue setting could not be changed."); }
  }
  if (loading && authenticated === null) return <p role="status" className="rounded-3xl border border-blush bg-white p-7">Checking staff session...</p>;
  if (!authenticated) return <section className="mx-auto max-w-lg">
    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Owner settings</p><h1 className="mt-3 text-3xl font-semibold">Salon Settings</h1>
    <p className="mt-2 text-charcoal/70">Use the existing staff access code. No separate admin login is used.</p>
    <form className="mt-6 rounded-3xl border border-blush bg-white p-6 shadow-sm" onSubmit={login}>
      <label htmlFor="owner-code" className="mb-2 block text-sm font-medium">Staff access code</label>
      <input id="owner-code" type="password" autoComplete="current-password" required className="min-h-12 w-full rounded-xl border border-charcoal/20 px-4" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
      {loginError && <p role="alert" className="mt-3 text-sm text-red-700">{loginError}</p>}
      <button className="mt-5 min-h-12 w-full rounded-full bg-rosewood px-6 font-semibold text-white">Open owner settings</button>
    </form>
  </section>;

  return <section className="space-y-8">
    <header><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Owner settings</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Salon Settings</h1><p className="mt-2 text-charcoal/65">Manage services, today's barbers, queue access, and daily performance.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-900">{notice}</p>}
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-blush bg-white p-5 shadow-sm">
      <div><h2 className="text-xl font-semibold">Online queue</h2><p className="mt-1 text-sm text-charcoal/65">Walk-in registration by staff remains available when closed.</p></div>
      <button type="button" role="switch" aria-checked={Boolean(settings?.onlineQueueOpen)} onClick={() => void changeQueue(!settings?.onlineQueueOpen)} className={"min-h-12 rounded-full px-6 font-semibold text-white " + (settings?.onlineQueueOpen ? "bg-emerald-700" : "bg-charcoal")}>Online joining: {settings?.onlineQueueOpen ? "Open" : "Closed"}</button>
    </section>
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Today's statistics">
      <article className="rounded-3xl border border-blush bg-white p-5"><p className="text-sm text-charcoal/60">Customers served</p><p className="mt-2 text-3xl font-semibold">{stats?.customersServed ?? "..."}</p></article>
      <article className="rounded-3xl border border-blush bg-white p-5"><p className="text-sm text-charcoal/60">Average waiting time</p><p className="mt-2 text-3xl font-semibold">{stats?.averageWaitingMinutes == null ? "..." : stats.averageWaitingMinutes + " min"}</p><p className="mt-1 text-xs text-charcoal/55">Completed service records today</p></article>
      <article className="rounded-3xl border border-blush bg-white p-5"><p className="text-sm text-charcoal/60">No-shows</p><p className="mt-2 text-3xl font-semibold">{stats?.noShows ?? "..."}</p></article>
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-blush bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Services</h2>
        {services.length === 0 ? <p className="mt-4 rounded-2xl bg-cream p-5 text-sm">No services have been added yet.</p> : <div className="mt-5 space-y-3">{services.map((service) => <article key={service.id} className="flex flex-col gap-4 rounded-2xl border border-charcoal/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">{service.name} <span className="font-normal text-charcoal/55">... {service.name_gu}</span></h3><p className="mt-1 text-sm text-charcoal/65">{service.duration_minutes} min ... {price(service.price)}</p><p className="mt-1 text-xs text-charcoal/55">{service.is_active ? "On" : "Off ... hidden from customers"}</p></div>
          <div className="flex gap-2"><button type="button" className="min-h-10 rounded-full border border-charcoal/20 px-4 text-sm" onClick={() => edit(service)}>Edit</button><button type="button" disabled={saving} className="min-h-10 rounded-full bg-charcoal px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void toggleService(service)}>{service.is_active ? "Turn off" : "Turn on"}</button></div>
        </article>)}</div>}
      </div>
      <form className="h-fit rounded-3xl border border-blush bg-white p-5 shadow-sm sm:p-7" onSubmit={submitService}><h2 className="text-xl font-semibold">{editId ? "Edit service" : "Add service"}</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium">Name (English)<input required maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-sm font-medium">Name (Gujarati)<input required maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={form.name_gu} onChange={(e) => setForm({ ...form, name_gu: e.target.value })} /></label>
          <label className="block text-sm font-medium">Category<input required maxLength={60} className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label className="block text-sm font-medium">Description<textarea required maxLength={500} className="mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Price<input type="number" min="0" step="1" required className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label className="block text-sm font-medium">Duration (minutes)<input type="number" min="1" required className="mt-1 min-h-11 w-full rounded-xl border border-charcoal/20 px-3" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></label></div>
        </div>
        <div className="mt-5 flex gap-2"><button disabled={saving} className="min-h-11 rounded-full bg-rosewood px-5 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editId ? "Save changes" : "Add service"}</button>{editId && <button type="button" className="min-h-11 rounded-full border px-5" onClick={() => { setEditId(""); setForm(blankService); }}>Cancel</button>}</div>
      </form>
    </section>
    <section className="rounded-3xl border border-blush bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Barbers</h2><p className="mt-1 text-sm text-charcoal/65">Manage today's duty and break status.</p></div>
        <form className="flex w-full gap-2 sm:w-auto" onSubmit={(e) => void addBarber(e)}><label className="sr-only" htmlFor="barber-name">Barber name</label><input id="barber-name" required maxLength={100} className="min-h-11 min-w-0 flex-1 rounded-full border border-charcoal/20 px-4 sm:w-56" placeholder="Barber name" value={barberName} onChange={(e) => setBarberName(e.target.value)} /><button disabled={saving} className="min-h-11 rounded-full bg-charcoal px-5 font-semibold text-white">Add</button></form>
      </div>
      {!barbers.length ? <p className="mt-5 rounded-2xl bg-cream p-5 text-sm">No barbers in the roster. Add a barber to set today's availability.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{barbers.map((barber) => <article key={barber.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charcoal/10 p-4">
        <div><h3 className="font-semibold">{barber.name}</h3><p className="mt-1 text-xs text-charcoal/55">{barber.on_duty ? barber.on_break ? "On duty ... On break" : "On duty ... Available" : "Off duty"}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" className="min-h-10 rounded-full border px-4 text-sm" disabled={saving} onClick={() => void toggleDuty(barber)}>{barber.on_duty ? "Set off duty" : "Set on duty"}</button><button type="button" className="min-h-10 rounded-full border px-4 text-sm disabled:opacity-40" disabled={saving || !barber.on_duty} onClick={() => void toggleBreak(barber)}>{barber.on_break ? "Return from break" : "Start break"}</button></div>
      </article>)}</div>}
    </section>
  </section>;
}
