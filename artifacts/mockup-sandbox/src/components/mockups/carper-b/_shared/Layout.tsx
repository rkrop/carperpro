import React from "react";
import { Search, MapPin, ScanLine, Mic, Home, Grid, Tag, User, ChevronRight } from "lucide-react";

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] p-8 font-sans">
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <div 
        className="relative overflow-hidden bg-white text-black ring-1 ring-white/10"
        style={{ width: "390px", height: "844px" }}
      >
        {children}
      </div>
    </div>
  );
}

export function TopNav({ query, onScan }: { query?: string, onScan?: () => void }) {
  return (
    <div className="bg-white border-b border-neutral-200 sticky top-0 z-30 pt-12 pb-4 px-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl font-black tracking-tighter uppercase">Carper.</span>
        <div className="flex items-center gap-1.5 text-[10px] font-medium tracking-widest uppercase text-neutral-500">
          <MapPin className="w-3 h-3" strokeWidth={1.5} />
          <span>Sucursal Centro</span>
        </div>
      </div>
      <div className="flex gap-0 border border-neutral-200">
        <div className="flex-1 flex items-center bg-white px-4 py-3">
          <Search className="w-4 h-4 text-neutral-400 mr-3" strokeWidth={1.5} />
          <input 
            type="text" 
            placeholder="Buscar refacción..." 
            className="bg-transparent border-none outline-none w-full text-sm font-medium placeholder:text-neutral-400"
            defaultValue={query}
          />
          <Mic className="w-4 h-4 text-neutral-400 ml-3" strokeWidth={1.5} />
        </div>
        <button className="bg-neutral-100 text-black px-4 flex items-center justify-center border-l border-neutral-200 transition-colors active:bg-neutral-200" onClick={onScan}>
          <ScanLine className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export function BottomNav({ active }: { active: "inicio" | "categorias" | "buscar" | "ofertas" | "cuenta" }) {
  const tabs = [
    { id: "inicio", icon: Home, label: "Inicio" },
    { id: "categorias", icon: Grid, label: "Categorías" },
    { id: "buscar", icon: Search, label: "Buscar" },
    { id: "ofertas", icon: Tag, label: "Ofertas" },
    { id: "cuenta", icon: User, label: "Cuenta" }
  ] as const;

  const routes: Record<string, string> = {
    inicio: "/__mockup/preview/carper-b/Inicio",
    categorias: "/__mockup/preview/carper-b/Inicio",
    buscar: "/__mockup/preview/carper-b/Resultados",
    ofertas: "/__mockup/preview/carper-b/Resultados",
    cuenta: "/__mockup/preview/carper-b/Inicio",
  };

  return (
    <div className="absolute bottom-0 w-full bg-white border-t border-neutral-200 px-6 py-4 flex justify-between z-30 pb-8">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <a key={tab.id} href={routes[tab.id]} className={`flex flex-col items-center gap-1.5 ${isActive ? "text-[#0055FF]" : "text-neutral-400"}`}>
            <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
            <span className="text-[9px] font-bold tracking-widest uppercase">{tab.label}</span>
          </a>
        );
      })}
    </div>
  );
}

export function Placeholder({ category }: { category: string }) {
  return (
    <div className="w-full h-full bg-neutral-50 flex flex-col items-center justify-center group">
      <div className="w-12 h-12 border border-neutral-200 flex items-center justify-center mb-3 text-neutral-300 group-hover:border-[#0055FF] group-hover:text-[#0055FF] transition-colors">
        <Grid className="w-5 h-5" strokeWidth={1} />
      </div>
      <span className="text-[9px] text-neutral-400 uppercase tracking-widest px-4 text-center">{category}</span>
    </div>
  );
}

export function CompatibilityBadge({ vehicle, subtle = false }: { vehicle: string, subtle?: boolean }) {
  if (subtle) {
    return (
      <div className="flex items-center gap-1.5 text-[#0055FF]">
        <div className="w-3 h-3 flex items-center justify-center text-[8px] font-bold">✓</div>
        <span className="text-[10px] font-bold tracking-tight uppercase">COMPATIBLE: {vehicle}</span>
      </div>
    );
  }
  return (
    <div className="border border-[#0055FF] bg-[#0055FF]/5 px-4 py-3 flex items-center gap-3">
      <div className="bg-[#0055FF] text-white w-5 h-5 flex items-center justify-center text-[10px] font-bold">✓</div>
      <span className="text-[11px] font-bold tracking-widest uppercase text-[#0055FF]">Compatible con tu {vehicle}</span>
    </div>
  );
}

export function AccentButton({ children, onClick, className = "" }: { children: React.ReactNode, onClick?: () => void, className?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`bg-[#0055FF] text-white w-full py-4 text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 active:bg-[#0044CC] transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
