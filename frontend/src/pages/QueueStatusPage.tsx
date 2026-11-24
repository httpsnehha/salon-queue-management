import { Link, useParams } from "react-router-dom";
export default function QueueStatusPage() {
  const { id } = useParams();
  return <section className="mx-auto max-w-2xl text-center"><h1 className="text-3xl font-semibold">Queue Status</h1><div className="mt-7 rounded-3xl border border-blush bg-white p-8 shadow-sm"><p className="text-charcoal/70">Queue details will be shown here.</p><p className="mt-3 text-sm text-charcoal/50">Queue reference: {id}</p><Link className="mt-6 inline-flex rounded-full border border-charcoal/20 px-5 py-3 font-semibold" to="/">Return home</Link></div></section>;
}
