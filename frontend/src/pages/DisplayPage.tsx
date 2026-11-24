import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getDisplayQueue, type DisplayQueue } from "../lib/api";
import { queueSocket } from "../lib/socket";

type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

function formatToken(number: number) {
  return "#" + String(number).padStart(3, "0");
}

export default function DisplayPage() {
  const [queue, setQueue] = useState<DisplayQueue>({ nowServing: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const requestVersion = useRef(0);

  const refreshQueue = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const latestQueue = await getDisplayQueue();
      if (version !== requestVersion.current) return;
      setQueue(latestQueue);
      setError("");
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(requestError instanceof Error ? requestError.message : "Queue display could not be loaded.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const handleConnect = () => {
      setConnectionStatus("connected");
      void refreshQueue();
    };
    const handleDisconnect = () => {
      setConnectionStatus(queueSocket.active ? "reconnecting" : "disconnected");
    };
    const handleConnectError = () => {
      setConnectionStatus(queueSocket.active ? "reconnecting" : "disconnected");
    };

    queueSocket.on("queue:updated", refreshQueue);
    queueSocket.on("connect", handleConnect);
    queueSocket.on("disconnect", handleDisconnect);
    queueSocket.on("connect_error", handleConnectError);

    if (queueSocket.connected) {
      handleConnect();
    } else {
      queueSocket.connect();
      void refreshQueue();
    }

    return () => {
      queueSocket.off("queue:updated", refreshQueue);
      queueSocket.off("connect", handleConnect);
      queueSocket.off("disconnect", handleDisconnect);
      queueSocket.off("connect_error", handleConnectError);
      queueSocket.disconnect();
    };
  }, [refreshQueue]);

  const isEmpty = queue.nowServing.length === 0 && queue.upcoming.length === 0;
  const connectionText = connectionStatus === "connected" ? "Connected" : connectionStatus === "reconnecting" ? "Reconnecting" : "Disconnected";
  const connectionColor = connectionStatus === "connected" ? "bg-emerald-300" : connectionStatus === "reconnecting" ? "bg-amber-300" : "bg-rose-300";

  return <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[1800px] flex-col text-center">
    <Link
      to="/"
      className="mb-5 inline-flex min-h-10 self-start items-center rounded-full border border-white/15 px-4 py-2 text-sm text-cream/70 transition hover:border-blush/60 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:mb-3"
    >
      <span aria-hidden="true" className="mr-2">←</span>Back to Home
    </Link>
    <header className="flex flex-col items-center justify-between gap-5 sm:flex-row sm:text-left">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blush sm:text-base">Maison Rose</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl lg:text-5xl">Now serving</h1>
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-end">
        <time className="text-2xl font-semibold tabular-nums sm:text-3xl" dateTime={currentTime.toISOString()}>
          {currentTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </time>
        <p className="text-sm text-cream/65 sm:text-base">
          {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs text-cream/60" role="status" aria-live="polite">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${connectionColor}`} />
          Live updates: {connectionText}
        </p>
      </div>
    </header>

    {error && <p className="mx-auto mt-6 max-w-2xl rounded-xl bg-white/10 p-4 text-sm text-white" role="alert">{error}</p>}

    <div className="mt-8 flex flex-1 flex-col justify-center lg:mt-10">
      {loading ? <p className="text-xl text-white/70 sm:text-2xl" role="status">Loading queue…</p> : isEmpty ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-16 sm:py-24">
          <p className="text-3xl font-semibold sm:text-5xl">The queue is currently empty</p>
          <p className="mt-4 text-lg text-white/65 sm:text-xl">There are no customers waiting or in service.</p>
        </div>
      ) : <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-9 lg:p-10" aria-labelledby="now-serving-heading">
          <h2 id="now-serving-heading" className="text-sm font-semibold uppercase tracking-[0.2em] text-blush sm:text-base">Now Serving</h2>
          {queue.nowServing.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {queue.nowServing.map((entry) => <div key={entry.id} className="flex min-h-48 flex-col justify-center border-b border-white/10 pb-5 last:border-0 sm:min-h-56">
              <p className="whitespace-nowrap text-[clamp(4rem,12vw,10rem)] font-bold leading-none tracking-tight tabular-nums">{formatToken(entry.token_number)}</p>
              <p className="mt-4 text-lg text-white/75 sm:text-2xl">{entry.service_name}</p>
            </div>)}
          </div> : <p className="mt-8 text-xl text-white/65 sm:text-2xl">No customers currently in service</p>}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-9 lg:p-10" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="text-sm font-semibold uppercase tracking-[0.2em] text-blush sm:text-base">Upcoming</h2>
          {queue.upcoming.length ? <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {queue.upcoming.map((entry) => <li key={entry.id} className="flex min-h-24 items-center justify-between gap-4 rounded-2xl bg-white/5 px-5 py-4 text-left sm:min-h-28 sm:px-6">
              <span className="whitespace-nowrap text-4xl font-semibold tabular-nums sm:text-5xl">{formatToken(entry.token_number)}</span>
              <span className="text-base text-white/70 sm:text-lg">{entry.service_name}</span>
            </li>)}
          </ol> : <p className="mt-8 text-xl text-white/65 sm:text-2xl">No upcoming customers</p>}
        </section>
      </div>}
    </div>
  </section>;
}
