import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, changeQueueStatus, createStaffSession, endStaffSession, getStaffQueue, type QueueStatus, type StaffQueueEntry } from "../lib/api";
import { queueSocket } from "../lib/socket";

const sections: QueueStatus[] = ["Waiting", "In Service", "Completed", "Cancelled"];

function formatToken(number: number) {
  return "#" + String(number).padStart(3, "0");
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function getMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export default function StaffPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [entries, setEntries] = useState<StaffQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState("");
  const inFlight = useRef(new Set<string>());
  const queueRequestVersion = useRef(0);

  const loadQueue = useCallback(async () => {
    const requestVersion = ++queueRequestVersion.current;
    setLoading(true);
    try {
      const result = await getStaffQueue();
      if (requestVersion !== queueRequestVersion.current) return;
      setEntries(result.entries);
      setAuthenticated(true);
      setError("");
    } catch (requestError) {
      if (requestVersion !== queueRequestVersion.current) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        setAuthenticated(false);
        setEntries([]);
      } else {
        setError(getMessage(requestError));
      }
    } finally {
      if (requestVersion === queueRequestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  useEffect(() => {
    if (!authenticated) return;
    const handleQueueUpdate = () => { void loadQueue(); };
    const handleReconnect = () => { void loadQueue(); };
    queueSocket.on("queue:updated", handleQueueUpdate);
    queueSocket.on("connect", handleReconnect);
    if (!queueSocket.active) queueSocket.connect();
    return () => {
      queueSocket.off("queue:updated", handleQueueUpdate);
      queueSocket.off("connect", handleReconnect);
      queueSocket.disconnect();
    };
  }, [authenticated, loadQueue]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessCode.trim()) {
      setLoginError("Enter the staff access code.");
      return;
    }
    setLoginError("");
    try {
      await createStaffSession(accessCode);
      setAccessCode("");
      setAuthenticated(true);
      await loadQueue();
    } catch (requestError) {
      setLoginError(getMessage(requestError));
    }
  }

  async function handleLogout() {
    try {
      await endStaffSession();
      setAuthenticated(false);
      setEntries([]);
      setNotice("");
    } catch (requestError) {
      setError(getMessage(requestError));
    }
  }

  async function handleStatusChange(entry: StaffQueueEntry, status: QueueStatus) {
    if (inFlight.current.size > 0) return;
    inFlight.current.add(entry.id);
    setPendingId(entry.id);
    setError("");
    setNotice("");
    try {
      await changeQueueStatus(entry.id, status);
      setNotice(formatToken(entry.token_number) + " moved to " + status + ".");
      await loadQueue();
    } catch (requestError) {
      setError(getMessage(requestError));
      if (requestError instanceof ApiError && requestError.status === 401) setAuthenticated(false);
    } finally {
      inFlight.current.delete(entry.id);
      setPendingId("");
    }
  }

  if (authenticated === null && loading) {
    return <section className="rounded-3xl border border-blush bg-white p-7 text-charcoal/70" role="status">Checking staff session…</section>;
  }

  if (!authenticated) {
    return <section className="mx-auto max-w-lg">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Receptionist / staff</p>
      <h1 className="mt-3 text-3xl font-semibold">Staff Queue Dashboard</h1>
      <form className="mt-6 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-8" onSubmit={handleLogin}>
        <label className="mb-2 block text-sm font-medium" htmlFor="staff-access-code">Staff access code</label>
        <input className="min-h-12 w-full rounded-xl border border-charcoal/20 px-4 outline-none focus:border-rosewood focus:ring-2 focus:ring-blush" id="staff-access-code" type="password" autoComplete="current-password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} />
        {(loginError || error) && <p className="mt-3 text-sm text-red-700" role="alert">{loginError || error}</p>}
        <button className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-rosewood px-6 py-3 font-semibold text-white hover:bg-charcoal" type="submit">Open staff dashboard</button>
      </form>
    </section>;
  }

  const counts = sections.map((status) => ({ status, count: entries.filter((entry) => entry.status === status).length }));

  return <section>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">Receptionist / staff</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Staff Queue Dashboard</h1><p className="mt-2 text-charcoal/65">Today’s customers in token order.</p></div>
      <div className="flex gap-2">
        <button className="min-h-11 rounded-full border border-charcoal/20 px-5 py-2 font-semibold hover:bg-white" type="button" onClick={() => void loadQueue()}>Refresh</button>
        <button className="min-h-11 rounded-full border border-charcoal/20 px-5 py-2 font-semibold hover:bg-white" type="button" onClick={() => void handleLogout()}>Sign out</button>
      </div>
    </div>

    <div className="mt-7 grid gap-3 grid-cols-2 xl:grid-cols-4">
      {counts.map(({ status, count }) => <div className="rounded-2xl border border-blush bg-white p-4 shadow-sm" key={status}><p className="text-sm text-charcoal/60">{status}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div>)}
    </div>

    {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p>}
    {notice && <p className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-900" role="status">{notice}</p>}
    {loading ? <p className="mt-7 rounded-xl bg-white p-5 text-charcoal/70" role="status">Loading queue…</p> : (
      <div className="mt-7 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {sections.map((status) => {
          const items = entries.filter((entry) => entry.status === status);
          return <section className="min-w-0 rounded-3xl border border-blush bg-[#fffdfa] p-4 sm:p-5" key={status}>
            <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">{status}</h2><span className="rounded-full bg-cream px-3 py-1 text-sm font-medium">{items.length}</span></div>
            {items.length === 0 ? <p className="mt-5 rounded-2xl bg-white p-4 text-sm text-charcoal/60">{status === "Waiting" ? "No customers waiting." : "No customers in this section."}</p> : (
              <div className="mt-4 space-y-3">
                {items.map((entry) => <article className="rounded-2xl border border-charcoal/10 bg-white p-4 shadow-sm" key={entry.id}>
                  <div className="flex items-start justify-between gap-2"><p className="text-2xl font-semibold tracking-tight">{formatToken(entry.token_number)}</p><span className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold">{entry.status}</span></div>
                  <h3 className="mt-3 font-semibold">{entry.customer_name}</h3>
                  <p className="mt-1 text-sm text-charcoal/70">{entry.service_name}</p>
                  <dl className="mt-4 space-y-2 border-t border-charcoal/10 pt-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-charcoal/55">Duration</dt><dd>{entry.service_duration_minutes} min</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-charcoal/55">Registered</dt><dd className="text-right">{formatTime(entry.registered_at)}</dd></div>
                  </dl>
                  {status === "Waiting" && <div className="mt-4 grid gap-2">
                    <button className="min-h-10 rounded-full bg-rosewood px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal disabled:opacity-60" disabled={pendingId !== ""} type="button" onClick={() => void handleStatusChange(entry, "In Service")}>{pendingId === entry.id ? "Updating…" : "Start Service"}</button>
                    <button className="min-h-10 rounded-full border border-charcoal/20 px-4 py-2 text-sm font-semibold hover:bg-cream disabled:opacity-60" disabled={pendingId !== ""} type="button" onClick={() => void handleStatusChange(entry, "Cancelled")}>{pendingId === entry.id ? "Updating…" : "Cancel Queue Entry"}</button>
                  </div>}
                  {status === "In Service" && <button className="mt-4 min-h-10 w-full rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-rosewood disabled:opacity-60" disabled={pendingId !== ""} type="button" onClick={() => void handleStatusChange(entry, "Completed")}>{pendingId === entry.id ? "Updating…" : "Complete Service"}</button>}
                  {status === "Cancelled" && <p className="mt-4 border-t border-charcoal/10 pt-3 text-xs text-charcoal/55">Read-only record. Cancelled tokens are retained.</p>}
                </article>)}
              </div>
            )}
          </section>;
        })}
      </div>
    )}
  </section>;
}