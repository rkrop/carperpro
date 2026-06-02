import React from "react";
import { PhoneFrame, TopNav, BottomNav, AccentButton } from "./_shared/Layout";
import { Car, ChevronRight, Zap, Clock, ScanLine } from "lucide-react";
import { motion } from "framer-motion";

export default function Inicio() {
  const categories = [
    "Marchas", "Sistema Eléctrico", "Inyección", 
    "Iluminación", "Filtros", "Encendido", 
    "Alternadores", "Enfriamiento", "Rodamientos"
  ];

  return (
    <PhoneFrame>
      <TopNav />
      
      <div className="h-full overflow-y-auto pb-32 no-scrollbar bg-neutral-50">
        
        {/* Hero / Vehicle */}
        <section className="bg-white px-6 py-10 border-b border-neutral-200">
          <h1 className="text-4xl font-black tracking-tighter leading-[0.9] mb-6 uppercase">
            Rápido.<br/>Simple.<br/>Eficiente.
          </h1>
          
          <div className="border border-neutral-200 p-5 group hover:border-black transition-colors cursor-pointer flex flex-col">
            <div className="flex items-center gap-3 mb-3">
              <Car className="w-5 h-5 text-neutral-400" strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500">Mi Vehículo</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-sm font-bold tracking-tight uppercase">Nissan Tsuru</p>
                <p className="text-[11px] font-medium text-neutral-500 uppercase mt-0.5">1.6L • 1992</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="px-6 py-8">
          <div className="grid grid-cols-2 gap-px bg-neutral-200 border border-neutral-200">
            <div className="bg-white p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-neutral-50">
              <ScanLine className="w-6 h-6 text-black" strokeWidth={1} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-center">Escanear<br/>Refacción</span>
            </div>
            <div className="bg-white p-4 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-neutral-50">
              <Clock className="w-6 h-6 text-black" strokeWidth={1} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-center">Recoger<br/>En Tienda</span>
            </div>
          </div>
        </section>

        {/* Deal Strip */}
        <section className="bg-white border-y border-neutral-200 py-6 px-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-[#0055FF] fill-[#0055FF]" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#0055FF]">Oferta del Día</span>
            </div>
            <p className="text-lg font-black tracking-tighter uppercase">Marchas Bosch -20%</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 block mb-1">Termina en</span>
            <span className="font-mono text-sm tracking-tighter">04:12:59</span>
          </div>
        </section>

        {/* Categories */}
        <section className="px-6 py-10 bg-white border-b border-neutral-200">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 mb-6">Categorías Populares</h2>
          <div className="grid grid-cols-3 gap-px bg-neutral-200 border border-neutral-200">
            {categories.map((cat, i) => (
              <div key={i} className="bg-white p-4 flex items-center justify-center text-center aspect-square hover:bg-neutral-50 cursor-pointer">
                <span className="text-[9px] font-bold tracking-widest uppercase text-black">{cat}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Recently Viewed */}
        <section className="px-6 py-10 bg-neutral-50">
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 mb-6">Vistos Recientemente</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-6 px-6">
            <a href="/__mockup/preview/carper-b/Producto" className="block w-[140px] flex-shrink-0 bg-white border border-neutral-200 p-3">
              <div className="aspect-square bg-neutral-100 mb-3">
                <img src="/__mockup/images/carper-alternator.png" alt="Alternador" className="w-full h-full object-cover mix-blend-multiply" />
              </div>
              <p className="text-[9px] font-bold tracking-widest uppercase text-neutral-400 mb-1">SKU 990</p>
              <p className="text-[10px] font-bold uppercase line-clamp-2 leading-snug mb-2">Alternador Tsuru 1.6</p>
              <p className="text-sm font-mono tracking-tighter">$646.04</p>
            </a>
            <a href="/__mockup/preview/carper-b/Producto" className="block w-[140px] flex-shrink-0 bg-white border border-neutral-200 p-3">
              <div className="aspect-square bg-neutral-100 mb-3">
                <img src="/__mockup/images/carper-starter.png" alt="Marcha" className="w-full h-full object-cover mix-blend-multiply" />
              </div>
              <p className="text-[9px] font-bold tracking-widest uppercase text-neutral-400 mb-1">SKU 2740</p>
              <p className="text-[10px] font-bold uppercase line-clamp-2 leading-snug mb-2">Marcha Bosch Tsuru</p>
              <p className="text-sm font-mono tracking-tighter">$1,792.33</p>
            </a>
          </div>
        </section>

      </div>

      <BottomNav active="inicio" />
    </PhoneFrame>
  );
}
