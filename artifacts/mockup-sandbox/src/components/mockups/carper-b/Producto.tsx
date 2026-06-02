import React from "react";
import { PhoneFrame, TopNav, CompatibilityBadge, AccentButton } from "./_shared/Layout";
import { ChevronLeft, Share2, Info, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

export default function Producto() {
  return (
    <PhoneFrame>
      {/* Custom Product TopNav */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-30 pt-12 pb-4 px-6 flex items-center justify-between">
        <a href="/__mockup/preview/carper-b/Resultados" className="w-8 h-8 flex items-center justify-center border border-neutral-200">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </a>
        <span className="text-[10px] font-bold tracking-widest uppercase">Detalle de Refacción</span>
        <button className="w-8 h-8 flex items-center justify-center border border-neutral-200">
          <Share2 className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
      
      <div className="h-full overflow-y-auto pb-40 no-scrollbar bg-neutral-50 relative">
        
        {/* Full Bleed Image */}
        <div className="w-full aspect-square bg-white border-b border-neutral-200 relative">
          <img src="/__mockup/images/carper-starter.png" alt="Marcha Bosch Tsuru" className="w-full h-full object-cover mix-blend-multiply p-8" />
          <div className="absolute bottom-4 left-4 bg-black text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1.5">
            BOSCH
          </div>
        </div>

        {/* Product Meta */}
        <div className="bg-white px-6 py-8 border-b border-neutral-200">
          <div className="flex justify-between items-start mb-4">
            <span className="font-mono text-sm tracking-tight bg-neutral-100 px-2 py-1">SKU 2740</span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
              En existencia
            </span>
          </div>
          
          <h1 className="text-2xl font-black uppercase leading-[1.1] tracking-tighter mb-6">
            MARCHA BOSCH TSURU
          </h1>
          
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 mb-1">Precio Unitario</p>
              <p className="font-mono text-4xl font-bold tracking-tighter">$1,792.33</p>
            </div>
          </div>
        </div>

        {/* Compatibility */}
        <div className="px-6 py-8 bg-white border-b border-neutral-200 space-y-4">
          <CompatibilityBadge vehicle="NISSAN TSURU 1.6 1992" />
          
          <button className="w-full flex items-center justify-between py-3 border-b border-neutral-200 group">
            <span className="text-[10px] font-bold tracking-widest uppercase">Ver 12 vehículos compatibles más</span>
            <ChevronLeft className="w-4 h-4 rotate-180 text-neutral-400 group-hover:text-black" strokeWidth={1.5} />
          </button>
          
          <div className="flex items-center gap-2 pt-2">
            <Info className="w-4 h-4 text-neutral-400" strokeWidth={1.5} />
            <a href="#" className="text-[10px] font-bold tracking-widest uppercase text-neutral-500 underline underline-offset-4 decoration-neutral-300 hover:text-black">
              Confirmar con un asesor
            </a>
          </div>
        </div>

        {/* Especificaciones Técnicas */}
        <div className="px-6 py-8 bg-white mb-8">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-neutral-400 mb-6">Especificaciones Técnicas</h3>
          
          <div className="space-y-0 border-t border-neutral-200">
            <div className="flex justify-between py-4 border-b border-neutral-200">
              <span className="text-[10px] font-bold tracking-widest uppercase">Marca</span>
              <span className="text-[11px] font-medium uppercase">BOSCH</span>
            </div>
            <div className="flex justify-between py-4 border-b border-neutral-200">
              <span className="text-[10px] font-bold tracking-widest uppercase">Voltaje</span>
              <span className="text-[11px] font-medium uppercase">12V</span>
            </div>
            <div className="flex justify-between py-4 border-b border-neutral-200">
              <span className="text-[10px] font-bold tracking-widest uppercase">Rotación</span>
              <span className="text-[11px] font-medium uppercase">CW (Derecha)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Sticky CTA */}
      <div className="absolute bottom-0 w-full bg-white border-t border-neutral-200 p-6 z-40 pb-8">
        <AccentButton className="h-14">
          <ShoppingCart className="w-4 h-4" />
          Agregar al Carrito
        </AccentButton>
      </div>

    </PhoneFrame>
  );
}
