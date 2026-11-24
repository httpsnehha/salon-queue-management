import { useCallback, useEffect, useState } from "react";
import { getDisplayQueue, type DisplayQueue } from "../lib/api";
import { queueSocket } from "../lib/socket";

function formatToken(number: number) {
  return "#" + String(number).padStart(3, "0");
}

export default function DisplayPage() {
  const [queue, setQueue] = useState<DisplayQueue>({ nowServing: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshQueue = useCallback(async () => {
    try {
      setQueue(await getDisplayQueue());
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Queue display could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshQueue(); }, [refreshQueue]);
  useEffect(() => {
    queueSocket.on("queue:updated", refreshQueue);
    queueSocket.connect();
    return () => {
      queueSocket.off("queue:updated", refreshQueue);
      queueSocket.disconnect();
    };
  }, [refreshQueue]);

  const isEmpty = queue.nowServing.length === 0 && queue.upcoming.length === 0;

  return <section className="mx-auto max-w-6xl text-center">
    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blush">Maison Rose</p>
    <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">Live Queue Display</h1>
    {error && <p className="mx-auto mt-5 max-w-2xl rounded-xl bg-white/10 p-4 text-sm text-white" role="alert">{error}</p>}
    {loading ? <p className="mt-10 text-xl text-white/70" role="status">Loading queue…</p> : isEmpty ? (
      <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-12"><p className="text-2xl text-white/80">No customers currently waiting</p></div>
    ) : <div className="mt-10 grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-10">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blush">Now Serving</h2>
        {queue.nowServing.length ? <div className="mt-6 space-y-5">
          {queue.nowServing.map((entry) => <div key={entry.id} className="border-b border-white/10 pb-5 last:border-0">
            <p className="text-6xl font-bold sm:text-8xl">{formatToken(entry.token_number)}</p><p className="mt-2 text-lg text-white/75">{entry.service_name}</p>
          </div>)}
        </div> : <p className="mt-6 text-xl text-white/65">No customers currently in service</p>}
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-10">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-blush">Upcoming</h2>
        {queue.upcoming.length ? <ol className="mt-6 space-y-3">
          {queue.upcoming.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-5 py-4 text-left">
            <span className="text-3xl font-semibold">{formatToken(entry.token_number)}</span><span className="text-sm text-white/70">{entry.service_name}</span>
          </li>)}
        </ol> : <p className="mt-6 text-xl text-white/65">No upcoming tokens</p>}
      </section>
    </div>}
  </section>;
}