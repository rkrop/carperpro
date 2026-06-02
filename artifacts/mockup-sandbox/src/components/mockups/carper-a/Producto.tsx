import { PhoneFrame } from "./_shared/PhoneFrame";
import { AppShell } from "./_shared/AppShell";
import { ProductImage } from "./_shared/ProductPlaceholder";
import { CheckCircle2, ChevronDown, Info, MessageCircle, Share, Heart } from "lucide-react";

export default function Producto() {
  return (
    <PhoneFrame>
      <AppShell activeTab="buscar" showSearch={false}>
        <div className="flex flex-col pb-24 relative bg-white min-h-full">
          
          {/* Top Actions */}
          <div className="absolute top-0 w-full p-4 flex justify-end gap-2 z-10">
            <button className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center border border-[hsl(var(--c-border))] shadow-sm text-[hsl(var(--c-text))]">
              <Share size={18} />
            </button>
            <button className="w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center border border-[hsl(var(--c-border))] shadow-sm text-[hsl(var(--c-text))]">
              <Heart size={18} />
            </button>
          </div>

          {/* Product Image Gallery */}
          <div className="w-full aspect-square bg-[hsl(var(--c-bg))] p-8 border-b border-[hsl(var(--c-border))]">
            <ProductImage src="/__mockup/images/carper-starter.png" alt="MARCHA BOSCH TSURU" className="w-full h-full border-none bg-transparent" />
          </div>

          {/* Product Info */}
          <div className="p-4 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[hsl(var(--c-text-muted))] uppercase tracking-wider">BOSCH</span>
                <span className="text-xs carper-mono bg-[hsl(var(--c-bg))] px-2 py-1 rounded-md text-[hsl(var(--c-text))] border border-[hsl(var(--c-border))]">SKU 2740</span>
              </div>
              <h1 className="text-xl font-bold leading-tight mb-4">MARCHA BOSCH TSURU</h1>
              
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold tracking-tight text-[hsl(var(--c-accent))]">$1,792.33</div>
                  <div className="text-xs text-[hsl(var(--c-text-muted))] mt-1">Precio incluye IVA</div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--c-success))] mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--c-success))] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--c-success))]"></span>
                    </span>
                    En existencia (4)
                  </div>
                  <div className="text-xs text-[hsl(var(--c-text-muted))]">Sucursal Centro</div>
                </div>
              </div>
            </div>

            <hr className="border-[hsl(var(--c-border))]" />

            {/* Compatibility Section */}
            <div>
              <div className="bg-[hsl(var(--c-success-bg))] border border-[hsl(var(--c-success))]/20 rounded-xl p-4">
                <div className="flex gap-3">
                  <CheckCircle2 size={24} className="text-[hsl(var(--c-success))] shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-[hsl(var(--c-success))] mb-1">Compatible con tu vehículo</div>
                    <div className="text-sm font-medium text-[hsl(var(--c-text))]">Nissan Tsuru 1.6 1992</div>
                    
                    <button className="mt-3 text-xs font-bold text-[hsl(var(--c-success))] flex items-center gap-1 hover:opacity-80">
                      Ver otros vehículos compatibles <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 flex items-start gap-2 text-xs text-[hsl(var(--c-text-muted))] p-2 bg-[hsl(var(--c-bg))] rounded-lg">
                <Info size={14} className="shrink-0 mt-0.5" />
                <p>¿Dudas de compatibilidad? <button className="font-bold text-[hsl(var(--c-accent))]">Confirma con un asesor</button></p>
              </div>
            </div>

            <hr className="border-[hsl(var(--c-border))]" />

            {/* Details */}
            <div className="flex flex-col gap-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[hsl(var(--c-text-muted))]">Especificaciones</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-[hsl(var(--c-text-muted))]">Voltaje</div>
                <div className="font-medium text-right">12V</div>
                <div className="text-[hsl(var(--c-text-muted))]">Dientes</div>
                <div className="font-medium text-right">8</div>
                <div className="text-[hsl(var(--c-text-muted))]">Rotación</div>
                <div className="font-medium text-right">CW (Derecha)</div>
              </div>
              
              <div className="mt-2">
                <div className="text-sm text-[hsl(var(--c-text-muted))] mb-1">Equivalentes</div>
                <div className="flex gap-2">
                  <span className="text-xs carper-mono bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] px-2 py-1 rounded">BOS-2740</span>
                  <span className="text-xs carper-mono bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] px-2 py-1 rounded">VAL-9982</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sticky CTA */}
        <div className="absolute bottom-0 w-full bg-white border-t border-[hsl(var(--c-border))] p-4 pb-24 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20">
          <div className="flex gap-3">
            <button className="w-14 h-14 shrink-0 rounded-xl border border-[hsl(var(--c-border))] flex items-center justify-center text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-bg))]">
              <MessageCircle size={24} />
            </button>
            <button className="flex-1 bg-[hsl(var(--c-accent))] hover:bg-[hsl(var(--c-accent-hover))] text-white font-bold text-lg rounded-xl flex items-center justify-center shadow-lg shadow-[hsl(var(--c-accent))]/20 transition-transform active:scale-[0.98]">
              Agregar al carrito
            </button>
          </div>
        </div>
      </AppShell>
    </PhoneFrame>
  );
}
