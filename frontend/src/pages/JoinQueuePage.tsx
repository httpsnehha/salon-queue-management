import { Link } from "react-router-dom";
export default function JoinQueuePage() {
  return <section className="mx-auto max-w-2xl"><h1 className="text-3xl font-semibold">Join Queue</h1><div className="mt-6 rounded-3xl border border-blush bg-white p-6 shadow-sm sm:p-8"><p className="text-charcoal/70">Queue registration will be added in a later feature task.</p><Link className="mt-6 inline-flex rounded-full bg-rosewood px-5 py-3 font-semibold text-white" to="/">Back to services</Link></div></section>;
}
