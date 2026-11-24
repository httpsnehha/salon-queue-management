import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getDisplayQueue, type DisplayQueue } from "../lib/api";
import { queueSocket } from "../lib/socket";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
function token(value: number) { return "#" + String(value).padStart(3, "0"); }
export default function DisplayPage() {
  const [queue, setQueue] = useState<DisplayQueue>({ nowServing: [], called: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ConnectionStatus>("disconnected");
  const [time, setTime] = useState(() => new Date());
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    try { const result = await getDisplayQueue(); if (current === version.current) { setQueue(result); setError(""); } }
    catch (err) { if (current === version.current) setError(err instanceof Error ? err.message : "Queue display could not be loaded."); }
    finally { if (current === version.current) setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const connect = () => { setConnection("connected"); void refresh(); };
    const disconnect = () => setConnection(queueSocket.active ? "reconnecting" : "disconnected");
    queueSocket.on("queue:updated", refresh); queueSocket.on("connect", connect);
    queueSocket.on("disconnect", disconnect); queueSocket.on("connect_error", disconnect);
    if (queueSocket.connected) connect(); else { queueSocket.connect(); void refresh(); }
    return () => { queueSocket.off("queue:updated", refresh); queueSocket.off("connect", connect); queueSocket.off("disconnect", disconnect); queueSocket.off("connect_error", disconnect); queueSocket.disconnect(); };
  }, [refresh]);
  const empty = !queue.called.length && !queue.nowServing.length && !queue.upcoming.length;
  const connectionLabel = connection === "connected" ? "Connected" : connection === "reconnecting" ? "Reconnecting" : "Disconnected";
  const dot = connection === "connected" ? "bg-emerald-300" : connection === "reconnecting" ? "bg-amber-300" : "bg-rose-300";
  return <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1800px] flex-col text-center">
    <Link to="/" className="mb-5 inline-flex min-h-10 self-start items-center rounded-full border border-white/15 px-4 py-2 text-sm text-cream/70 hover:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush focus-visible:outline-blush">← Back to Home</Link>
    <header className="flex flex-col items-center justify-between gap-5 sm:flex-row sm:text-left"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-blush">Maison Rose</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl lg:text-5xl">Live Queue Display</h1></div>
      <div className="flex flex-col items-center gap-2 sm:items-end"><time className="text-2xl font-semibold tabular-nums sm:text-3xl" dateTime={time.toISOString()}>{time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><p className="text-sm text-cream/65 sm:text-base">{time.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p><p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-cream/60"><span aria-hidden="true" className={"h-2 w-2 rounded-full " + dot} />Live updates: {connectionLabel}</p></div>
    </header>
    {error && <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-xl bg-white/10 p-4 text-sm text-white">{error}</p>}
    <div className="mt-8 flex flex-1 flex-col justify-center">
      {loading ? <p role="status" className="text-xl text-white/70">Loading queue...</p> : empty
        ? <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 sm:py-24"><p className="text-3xl font-semibold sm:text-5xl">The queue is currently empty</p><p className="mt-4 text-lg text-white/65">There are no customers waiting, called, or in service.</p></div>
        : <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-9 lg:p-10"><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blush">Now Serving</h2>
            {queue.nowServing.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2">{queue.nowServing.map((entry) => <article key={entry.id} className="py-5"><p className="whitespace-nowrap text-[clamp(4rem,12vw,10rem)] font-bold leading-none tabular-nums">{token(entry.token_number)}</p><p className="mt-4 text-lg text-white/75 sm:text-2xl">{entry.service_name}</p>{entry.barber_name && <p className="mt-1 text-sm text-white/55">{entry.barber_name}</p>}</article>)}</div> : <p className="mt-8 text-xl text-white/65">No customers currently in service</p>}
          </section>
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blush">Please come forward</h2>{queue.called.length ? <ol className="mt-5 grid gap-3 sm:grid-cols-2">{queue.called.map((entry) => <li key={entry.id} className="rounded-2xl bg-rosewood/35 p-5 text-left"><p className="text-4xl font-bold tabular-nums">{token(entry.token_number)}</p><p className="mt-2 text-white/75">{entry.service_name}</p>{entry.barber_name && <p className="mt-1 text-sm text-white/60">Please see {entry.barber_name}</p>}</li>)}</ol> : <p className="mt-5 text-lg text-white/65">No customers have been called</p>}</div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8"><h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blush">Upcoming</h2>{queue.upcoming.length ? <ol className="mt-5 grid gap-3 sm:grid-cols-2">{queue.upcoming.map((entry) => <li key={entry.id} className="flex min-h-20 items-center justify-between gap-4 rounded-2xl bg-white/5 px-5 py-4 text-left"><span className="text-3xl font-semibold tabular-nums sm:text-4xl">{token(entry.token_number)}</span><span className="text-sm text-white/70">{entry.service_name}</span></li>)}</ol> : <p className="mt-5 text-lg text-white/65">No upcoming customers</p>}</div>
          </section>
        </div>}
    </div>
  </section>;
}
