import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRegistration, type QueueRegistration, type QueueStatus } from "../lib/api";
import { LanguageToggle, useCustomerLanguage } from "../components/CustomerLanguage";
import { queueSocket } from "../lib/socket";

function token(value: number) { return "#" + String(value).padStart(3, "0"); }
function tx(gu: boolean, en: string, translated: string) { return gu ? translated : en; }
const states: QueueStatus[] = ["Waiting", "Called", "In chair", "Done"];
function statusLabel(status: QueueStatus, gu: boolean) {
  if (!gu) return status;
  const labels: Record<QueueStatus, string> = {
    Waiting: "રાહ જોઈ રહ્યા છે", Called: "તમારો વારો છે", "In chair": "સેવા ચાલુ છે",
    Done: "પૂર્ણ", Cancelled: "રદ", "No-show": "હાજર ન રહ્યા",
  };
  return labels[status];
}
export default function QueueStatusPage() {
  const { id = "" } = useParams();
  const { language } = useCustomerLanguage();
  const gu = language === "gu";
  const [registration, setRegistration] = useState<QueueRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setRegistration(await getRegistration(id)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "This queue registration could not be found."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const update = (event: { registrationId: string }) => { if (event.registrationId === id) void load(); };
    const reconnect = () => { void load(); };
    queueSocket.on("queue:updated", update); queueSocket.on("connect", reconnect);
    if (!queueSocket.active) queueSocket.connect();
    return () => { queueSocket.off("queue:updated", update); queueSocket.off("connect", reconnect); queueSocket.disconnect(); };
  }, [id, load]);

  if (loading) return <section role="status" className="mx-auto max-w-2xl rounded-3xl border border-blush bg-white p-8 text-charcoal/70">Loading queue details...</section>;
  if (!registration) return <section className="mx-auto max-w-2xl rounded-3xl border border-blush bg-white p-8"><h1 className="text-2xl font-semibold">Queue details unavailable</h1><p className="mt-3 text-charcoal/70">{error || "This registration could not be found."}</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-full bg-rosewood px-5 font-semibold text-white" to="/">Return home</Link></section>;

  const terminal = registration.status === "Cancelled" || registration.status === "No-show";
  const progress = states.indexOf(registration.status);
  const barber = registration.assigned_barber_name || registration.preferred_barber_name;
  const message = registration.status === "Called"
    ? tx(gu, "It's your turn. Please go to the barber shown below.", "તમારો વારો છે. કૃપા કરીને નીચે દર્શાવેલા વાળંદ પાસે જાઓ.")
    : registration.status === "In chair"
      ? tx(gu, "Your service has started.", "તમારી સેવા શરૂ થઈ ગઈ છે.")
      : registration.status === "Done"
        ? tx(gu, "Your service is complete. Thank you for visiting.", "તમારી સેવા પૂર્ણ થઈ છે. મુલાકાત બદલ આભાર.")
        : registration.status === "Cancelled"
          ? tx(gu, "This queue registration is cancelled.", "આ કતાર નોંધણી રદ કરવામાં આવી છે.")
          : registration.status === "No-show"
            ? tx(gu, "This token was marked No-show. If you return, please register again for a new token.", "આ ટોકન ગેરહાજર તરીકે નોંધાયો છે. પાછા આવો ત્યારે નવા ટોકન માટે ફરી નોંધણી કરો.")
            : tx(gu, "Your registration is confirmed. The approximate wait may change as the queue moves.", "તમારી નોંધણી પુષ્ટિ થઈ છે. કતાર આગળ વધે તેમ અંદાજિત રાહનો સમય બદલાઈ શકે છે.");

  return <section className="mx-auto max-w-3xl">
    <div className="flex items-center justify-between"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-rosewood">{tx(gu, "Queue registration", "કતાર નોંધણી")}</p><LanguageToggle /></div>
    <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{tx(gu, "Your queue status", "તમારી કતારની સ્થિતિ")}</h1>
    <article className="mt-6 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-9">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-charcoal/55">{tx(gu, "Your token", "તમારો ટોકન")}</p><p className="mt-1 text-6xl font-bold tracking-tight sm:text-7xl">{token(registration.token_number)}</p></div><span className="w-fit rounded-full bg-cream px-4 py-2 text-sm font-semibold text-rosewood">{statusLabel(registration.status, gu)}</span></div>
      <div className="mt-7 grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-2"><div><p className="text-xs uppercase tracking-wide text-charcoal/50">{tx(gu, "Customer", "ગ્રાહક")}</p><p className="mt-1 font-medium">{registration.customer_name}</p></div><div><p className="text-xs uppercase tracking-wide text-charcoal/50">{tx(gu, "Service", "સેવા")}</p><p className="mt-1 font-medium">{gu ? registration.service_name_gu || registration.service_name : registration.service_name}</p></div><div><p className="text-xs uppercase tracking-wide text-charcoal/50">{tx(gu, "Barber", "વાળંદ")}</p><p className="mt-1 font-medium">{barber || tx(gu, "Any available barber", "કોઈપણ ઉપલબ્ધ વાળંદ")}</p></div><div><p className="text-xs uppercase tracking-wide text-charcoal/50">{tx(gu, "Status", "સ્થિતિ")}</p><p className="mt-1 font-medium">{statusLabel(registration.status, gu)}</p></div></div>
      {!terminal && <div className="mt-7"><ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">{states.map((step, index) => <li key={step} className={"rounded-xl p-3 text-center text-xs sm:text-sm " + (progress >= index ? "bg-rosewood text-white" : "bg-cream text-charcoal/55")}>{statusLabel(step, gu)}</li>)}</ol></div>}
      {registration.status === "Waiting" && <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-charcoal/10 p-4"><div><p className="text-xs uppercase text-charcoal/50">{tx(gu, "Queue position", "કતારમાં સ્થાન")}</p><p className="mt-1 font-medium">{registration.position ?? "..."}</p></div><div><p className="text-xs uppercase text-charcoal/50">{tx(gu, "Approximate waiting time", "અંદાજિત રાહનો સમય")}</p><p className="mt-1 font-medium">{registration.approximate_wait_minutes ?? "..."} min</p></div></div>}
      <p role="status" className="mt-6 rounded-2xl bg-cream p-4 text-sm leading-6 text-charcoal/70">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3"><button className="min-h-11 rounded-full border border-charcoal/20 px-5 font-semibold hover:bg-cream" type="button" onClick={() => void load()}>{tx(gu, "Refresh status", "સ્થિતિ તાજી કરો")}</button><Link className="inline-flex min-h-11 items-center rounded-full bg-rosewood px-5 font-semibold text-white" to="/">{tx(gu, "Return home", "ઘરે પાછા જાઓ")}</Link></div>
    </article>
  </section>;
}
