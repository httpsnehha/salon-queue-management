export default function StaffPage() {
  return <section><h1 className="text-3xl font-semibold">Staff Queue Dashboard</h1><div className="mt-7 grid gap-4 md:grid-cols-3">{["Waiting","In Service","Completed"].map((status)=><section key={status} className="min-h-48 rounded-3xl border border-blush bg-white p-5 shadow-sm"><h2 className="font-semibold">{status}</h2><p className="mt-3 text-sm text-charcoal/60">Queue entries will appear here.</p></section>)}</div></section>;
}
