import React, { useState } from "react";
import { PhoneFrame, TopNav, BottomNav, Placeholder, CompatibilityBadge } from "./_shared/Layout";
import { SlidersHorizontal, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function Resultados() {
  const [filterActive, setFilterActive] = useState<string | null>("BOSCH");
  const filters = ["BOSCH", "DENSO", "DELPHI", "HITACHI", "VALEO", "AIRTEX", "SIN MARCA"];

  const results = [
    {
      id: 1,
      name: "MARCHA BOSCH TSURU",
      brand: "BOSCH",
      sku: "2740",
      price: "$1,792.33",
      stock: true,
      image: "/__mockup/images/carper-starter.png",
      compatible: true
    },
    {
      id: 2,
      name: "ALTERNADOR PARA NISSAN TSURU 1.6 1986-1988 12V/70A",
      brand: "SIN MARCA",
      sku: "990",
      price: "$646.04",
      stock: true,
      image: "/__mockup/images/carper-alternator.png",
      compatible: true
    },
    {
      id: 3,
      name: "FILTRO AFINACIÓN SENTRA 1.8 2013-2018",
      brand: "NISSAN",
      sku: "CA6900",
      price: "$170.00",
      stock: true,
      image: null,
      compatible: false
    }
  ];

  return (
    <PhoneFrame>
      <TopNav query="marcha tsuru" />
      
      <div className="h-full overflow-y-auto pb-32 no-scrollbar bg-white">
        
        {/* Results Info & Filters */}
        <div className="px-6 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
          <p className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest mb-4">
            Mostrando resultados para <span className="text-black font-bold">"marcha tsuru"</span>
          </p>
          
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
            <button className="flex-shrink-0 flex items-center justify-center w-8 h-8 border border-neutral-200 text-black">
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
            </button>
            {filters.map(f => (
              <button 
                key={f}
                onClick={() => setFilterActive(f === filterActive ? null : f)}
                className={`flex-shrink-0 px-4 h-8 text-[9px] font-bold tracking-widest uppercase border transition-colors ${
                  f === filterActive 
                    ? "bg-black text-white border-black" 
                    : "bg-white text-black border-neutral-200 hover:border-black"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        <div className="divide-y divide-neutral-200">
          {results.map((product) => (
            <a key={product.id} href="/__mockup/preview/carper-b/Producto" className="block">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 flex gap-5 cursor-pointer hover:bg-neutral-50 transition-colors"
            >
              <div className="w-[100px] h-[100px] flex-shrink-0 border border-neutral-200 bg-neutral-50 relative">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover mix-blend-multiply p-2" />
                ) : (
                  <Placeholder category="Refacción" />
                )}
                {product.stock && (
                  <div className="absolute top-0 left-0 bg-black text-white text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5">
                    Stock
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-neutral-400">{product.brand}</span>
                  <span className="font-mono text-[10px] text-neutral-500">SKU {product.sku}</span>
                </div>
                
                <h3 className="text-xs font-bold uppercase leading-tight mb-2 line-clamp-2">{product.name}</h3>
                
                {product.compatible && (
                  <div className="mb-3">
                    <CompatibilityBadge vehicle="Tsuru 1.6" subtle />
                  </div>
                )}
                
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-mono text-base font-bold tracking-tighter">{product.price}</span>
                  <div className="w-8 h-8 border border-black flex items-center justify-center">
                    <Plus className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </motion.div>
            </a>
          ))}
        </div>

      </div>

      <BottomNav active="buscar" />
    </PhoneFrame>
  );
}
