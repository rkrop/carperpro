import React, { useState } from "react";
import {
  ChevronRight,
  ShoppingCart,
  Car,
  Minus,
  Plus,
  CheckCircle2,
  Package,
  Clock,
  MessageCircle,
  MapPin,
  ShieldCheck
} from "lucide-react";
import {
  AnnouncementBar,
  StoreHeader,
  StoreFooter,
  PayBadges,
  Money
} from "./_shared/Chrome";

const RELATED_PRODUCTS = [
  {
    title: "Alternador Valeo 90A",
    sku: "5521",
    brand: "VALEO",
    price: "$2,480.00",
    status: "En existencia",
    img: "/__mockup/images/carper-alternator.png",
  },
  {
    title: "Batería LTH L-42-500",
    sku: "8810",
    brand: "LTH",
    price: "$2,150.00",
    status: "Pocas piezas",
    img: "/__mockup/images/shop-battery.png",
  },
  {
    title: "Faro LED Tsuru",
    sku: "4102",
    brand: "SIN MARCA",
    price: "$1,340.00",
    status: "En existencia",
    img: "/__mockup/images/shop-headlight.png",
  },
  {
    title: "Filtro de aceite Fram",
    sku: "1207",
    brand: "FRAM",
    price: "$189.00",
    status: "En existencia",
    img: "/__mockup/images/shop-filter.png",
  },
];

export default function Producto() {
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState("desc");

  return (
    <div className="carper-shop min-h-screen flex flex-col bg-[hsl(var(--c-bg))]">
      <AnnouncementBar />
      <StoreHeader cartCount={2} />

      <main className="flex-1 py-8">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-[hsl(var(--c-text-muted))] mb-8">
            <a href="#" className="hover:text-[hsl(var(--c-text))]">Inicio</a>
            <ChevronRight size={14} />
            <a href="#" className="hover:text-[hsl(var(--c-text))]">Marchas</a>
            <ChevronRight size={14} />
            <span className="text-[hsl(var(--c-text))] font-medium">Marcha Bosch Tsuru 1.6</span>
          </nav>

          {/* Product Section */}
          <div className="flex flex-col lg:flex-row gap-12 mb-16">
            {/* Left: Image Gallery */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4">
              <div className="aspect-square bg-white border border-[hsl(var(--c-border))] rounded-2xl flex items-center justify-center p-8 relative overflow-hidden">
                <img 
                  src="/__mockup/images/carper-starter.png" 
                  alt="Marcha Bosch Tsuru 1.6" 
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  "/__mockup/images/carper-starter.png",
                  "/__mockup/images/shop-battery.png",
                  "/__mockup/images/shop-headlight.png",
                  "/__mockup/images/shop-filter.png"
                ].map((src, i) => (
                  <button 
                    key={i} 
                    className={`aspect-square bg-white border rounded-xl p-2 flex items-center justify-center hover:border-[hsl(var(--c-accent))] transition-colors ${i === 0 ? 'border-[hsl(var(--c-accent))] ring-1 ring-[hsl(var(--c-accent))]' : 'border-[hsl(var(--c-border))]'}`}
                  >
                    <img src={src} alt="Thumbnail" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Product Info */}
            <div className="w-full lg:w-1/2 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold tracking-wider text-[hsl(var(--c-text-muted))] uppercase">
                  BOSCH
                </span>
                <span className="carper-mono text-xs font-bold bg-[hsl(var(--c-border))] px-2 py-1 rounded text-[hsl(var(--c-text))]">
                  SKU 2740
                </span>
              </div>
              
              <h1 className="text-3xl font-extrabold text-[hsl(var(--c-text))] mb-4 leading-tight">
                Marcha Bosch Tsuru 1.6
              </h1>

              <div className="flex items-end gap-3 mb-6">
                <span className="text-4xl font-extrabold text-[hsl(var(--c-accent))]">
                  <Money>$1,792.33</Money>
                </span>
                <span className="text-sm text-[hsl(var(--c-text-muted))] pb-1">
                  Precio incluye IVA
                </span>
              </div>

              {/* Status */}
              <div className="flex items-center gap-4 mb-6 text-sm">
                <div className="flex items-center gap-1.5 text-[hsl(var(--c-success))] font-semibold bg-[hsl(var(--c-success))]/10 px-3 py-1.5 rounded-full">
                  <CheckCircle2 size={16} />
                  En existencia
                </div>
                <div className="flex items-center gap-1.5 text-[hsl(var(--c-text-muted))]">
                  <Clock size={16} />
                  Llega en 2-4 días o recoge hoy en sucursal
                </div>
              </div>

              {/* Compatibility Box */}
              <div className="bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-success))]/30 rounded-xl p-4 mb-8 flex gap-3">
                <div className="mt-0.5">
                  <Car size={20} className="text-[hsl(var(--c-success))]" />
                </div>
                <div>
                  <p className="font-semibold text-[hsl(var(--c-success))]">Compatible con tu vehículo</p>
                  <p className="text-sm text-[hsl(var(--c-text-muted))]">Nissan Tsuru 1.6 1992 <CheckCircle2 size={14} className="inline ml-1 text-[hsl(var(--c-success))]" /></p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 mb-8">
                <div className="flex gap-4">
                  <div className="flex items-center border border-[hsl(var(--c-border))] bg-white rounded-lg h-12 w-32 shrink-0">
                    <button 
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="w-10 h-full flex items-center justify-center text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-text))] transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <div className="flex-1 text-center font-semibold text-[hsl(var(--c-text))] select-none">
                      {qty}
                    </div>
                    <button 
                      onClick={() => setQty(qty + 1)}
                      className="w-10 h-full flex items-center justify-center text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-text))] transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button className="flex-1 bg-[hsl(var(--c-accent))] hover:bg-[hsl(var(--c-accent))]/90 text-white rounded-lg h-12 flex items-center justify-center gap-2 font-bold transition-colors">
                    <ShoppingCart size={18} />
                    Agregar al carrito
                  </button>
                </div>
                <button className="w-full bg-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-text))]/90 text-white rounded-lg h-12 font-bold transition-colors">
                  Comprar ahora
                </button>
              </div>

              {/* Alternative Channel */}
              <div className="border border-[hsl(var(--c-border))] rounded-xl p-5 mb-6 bg-white shadow-sm">
                <h3 className="text-sm font-semibold text-[hsl(var(--c-text))] mb-3 text-center">
                  ¿Prefiere pedir por WhatsApp o pagar en efectivo?
                </h3>
                <button className="w-full border-2 border-[hsl(var(--c-wa))] text-[hsl(var(--c-wa))] hover:bg-[hsl(var(--c-wa))]/5 rounded-lg h-11 flex items-center justify-center gap-2 font-bold transition-colors">
                  <MessageCircle size={18} />
                  Pedir por WhatsApp
                </button>
              </div>

              {/* Payment Methods */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-[hsl(var(--c-text-muted))]">Aceptamos tarjeta, OXXO, SPEI y Mercado Pago</p>
                <PayBadges />
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="bg-white border border-[hsl(var(--c-border))] rounded-2xl overflow-hidden mb-16">
            <div className="flex border-b border-[hsl(var(--c-border))] bg-[hsl(var(--c-bg))] px-6">
              {[
                { id: "desc", label: "Descripción" },
                { id: "specs", label: "Especificaciones" },
                { id: "oem", label: "Equivalencias OEM" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'border-[hsl(var(--c-accent))] text-[hsl(var(--c-accent))] bg-white' 
                      : 'border-transparent text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-text))]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div className="p-8">
              {activeTab === "desc" && (
                <div className="prose prose-sm max-w-none text-[hsl(var(--c-text))]">
                  <p className="mb-4">
                    La marcha o motor de arranque Bosch para Nissan Tsuru 1.6 está diseñada para brindar un encendido confiable y rápido en cualquier condición climática. Fabricada con materiales de alta resistencia, garantiza una larga vida útil y un rendimiento óptimo.
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-[hsl(var(--c-text-muted))]">
                    <li>Rendimiento superior bajo demanda exigente.</li>
                    <li>Componentes internos de cobre de alta pureza.</li>
                    <li>Sellado especial contra polvo y humedad.</li>
                    <li>Reemplazo directo (Plug & Play) sin adaptaciones.</li>
                  </ul>
                </div>
              )}
              
              {activeTab === "specs" && (
                <div className="max-w-2xl">
                  <table className="w-full text-sm text-left text-[hsl(var(--c-text))]">
                    <tbody>
                      <tr className="border-b border-[hsl(var(--c-border))]">
                        <th className="py-3 font-semibold w-1/3">Marca</th>
                        <td className="py-3 text-[hsl(var(--c-text-muted))]">BOSCH</td>
                      </tr>
                      <tr className="border-b border-[hsl(var(--c-border))] bg-[hsl(var(--c-bg))]/50">
                        <th className="py-3 font-semibold pl-2">Voltaje</th>
                        <td className="py-3 text-[hsl(var(--c-text-muted))] pl-2">12V</td>
                      </tr>
                      <tr className="border-b border-[hsl(var(--c-border))]">
                        <th className="py-3 font-semibold">Dientes del Bendix</th>
                        <td className="py-3 text-[hsl(var(--c-text-muted))]">9 Dientes</td>
                      </tr>
                      <tr className="border-b border-[hsl(var(--c-border))] bg-[hsl(var(--c-bg))]/50">
                        <th className="py-3 font-semibold pl-2">Giro</th>
                        <td className="py-3 text-[hsl(var(--c-text-muted))] pl-2">Derecho (CW)</td>
                      </tr>
                      <tr className="border-b border-[hsl(var(--c-border))]">
                        <th className="py-3 font-semibold">Garantía</th>
                        <td className="py-3 text-[hsl(var(--c-text-muted))]">12 meses</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "oem" && (
                <div>
                  <p className="text-sm text-[hsl(var(--c-text-muted))] mb-4">
                    Esta pieza es un reemplazo directo para los siguientes números de parte originales de fabricante (OEM):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["23300-M8200", "23300-M8201", "S114-800", "S114-800A"].map(code => (
                      <span key={code} className="carper-mono bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] px-3 py-1.5 rounded-lg text-sm text-[hsl(var(--c-text))] font-medium">
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related Products */}
          <div>
            <h2 className="text-2xl font-extrabold text-[hsl(var(--c-text))] mb-6">Productos Relacionados</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {RELATED_PRODUCTS.map((prod, i) => (
                <a key={i} href="#" className="group bg-white border border-[hsl(var(--c-border))] rounded-2xl overflow-hidden hover:shadow-lg transition-all flex flex-col">
                  <div className="aspect-square p-6 flex items-center justify-center bg-white relative">
                    <img src={prod.img} alt={prod.title} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute top-3 left-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                        prod.status === "En existencia" 
                          ? "bg-[hsl(var(--c-success))]/10 text-[hsl(var(--c-success))]" 
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {prod.status}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 border-t border-[hsl(var(--c-border))] flex-1 flex flex-col">
                    <div className="text-[10px] font-bold text-[hsl(var(--c-text-muted))] uppercase tracking-wider mb-1">
                      {prod.brand} • <span className="carper-mono text-[9px]">{prod.sku}</span>
                    </div>
                    <h3 className="font-semibold text-[hsl(var(--c-text))] leading-snug mb-3 flex-1 group-hover:text-[hsl(var(--c-accent))] transition-colors">
                      {prod.title}
                    </h3>
                    <div className="flex items-end justify-between mt-auto">
                      <div className="font-extrabold text-lg text-[hsl(var(--c-text))]">
                        <Money>{prod.price}</Money>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-[hsl(var(--c-bg))] text-[hsl(var(--c-accent))] flex items-center justify-center hover:bg-[hsl(var(--c-accent))] hover:text-white transition-colors">
                        <ShoppingCart size={14} />
                      </button>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
