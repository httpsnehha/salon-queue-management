import { Outlet, useLocation } from "react-router-dom";
import Navigation from "./Navigation";
export default function AppLayout() {
  const isDisplay = useLocation().pathname === "/display";
  return <div className={isDisplay ? "min-h-screen bg-charcoal text-cream" : "min-h-screen bg-cream text-charcoal"}>
    <header className="border-b border-blush/60 bg-white/75"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
      <a href="/" className="text-xl font-semibold tracking-tight">Maison Rose <span className="font-normal text-rosewood">Salon Queue</span></a><Navigation />
    </div></header><main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"><Outlet /></main>
  </div>;
}
