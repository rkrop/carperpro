import { PhoneFrame } from "./_shared/PhoneFrame";
import { AppShell } from "./_shared/AppShell";
import { ProductImage } from "./_shared/ProductPlaceholder";
import { CheckCircle2, SlidersHorizontal } from "lucide-react";
function Link({ href, children, ...props }: { href?: string; children?: any; [key: string]: any }) {
  return <a href={href} {...props}>{children}</a>;
}

export default function Resultados() {
  const brands = ["BOSCH", "DENSO", "DELPHI", "HITACHI", "VALEO", "AIRTEX", "Sin marca"];

  return (
    <PhoneFrame>
      <AppShell activeTab="buscar" searchQuery="marcha tsuru">
        <div className="flex flex-col h-full">
          {/* Header/Filters */}
          <div className="bg-white border-b border-[hsl(var(--c-border))] pb-3 pt-1 shrink-0">
            <div className="px-4 mb-3 flex items-center justify-between text-sm">
              <div className="text-[hsl(var(--c-text-muted))]">Mostrando resultados para <span className="font-bold text-[hsl(var(--c-text))]">"marcha tsuru"</span></div>
              <div className="font-medium">12 res.</div>
            </div>
            
            <div className="flex overflow-x-auto carper-hide-scroll px-4 gap-2">
              <button className="flex items-center gap-1 shrink-0 border border-[hsl(var(--c-border))] rounded-full px-3 py-1.5 text-xs font-medium bg-[hsl(var(--c-bg))]">
                <SlidersHorizontal size={14} /> Filtros
              </button>
              <button className="shrink-0 border border-[hsl(var(--c-accent))] text-[hsl(var(--c-accent))] bg-[hsl(var(--c-accent))]/10 rounded-full px-3 py-1.5 text-xs font-medium">
                En existencia
              </button>
              {brands.map(brand => (
                <button key={brand} className="shrink-0 border border-[hsl(var(--c-border))] rounded-full px-3 py-1.5 text-xs font-medium bg-white">
                  {brand}
                </button>
              ))}
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <ResultCard 
              sku="2740"
              name="MARCHA BOSCH TSURU"
              brand="BOSCH"
              price="$1,792.33"
              imageSrc="/__mockup/images/carper-starter.png"
              compatible={true}
            />
            <ResultCard 
              sku="990"
              name="ALTERNADOR PARA NISSAN TSURU 1.6 1986-1988 12V/70A"
              brand="Sin marca"
              price="$646.04"
              imageSrc="/__mockup/images/carper-alternator.png"
            />
            <ResultCard 
              sku="CA6900"
              name="FILTRO AFINACIÓN SENTRA 1.8 2013-2018"
              brand="INTERFIL"
              price="$170.00"
            />
            <ResultCard 
              sku="13586451-GM"
              name="BOMBA DE GASOLINA CHEVROLET SONIC 13-15 1.6L"
              brand="GM"
              price="$3,480.00"
            />
          </div>
        </div>
      </AppShell>
    </PhoneFrame>
  );
}

function ResultCard({ sku, name, brand, price, imageSrc, compatible = false }: any) {
  return (
    <div className="bg-white border border-[hsl(var(--c-border))] rounded-xl p-3 shadow-sm flex flex-col gap-3">
      <div className="flex gap-3">
        <div className="w-24 h-24 shrink-0 relative">
          <ProductImage src={imageSrc} alt={name} className="w-full h-full absolute inset-0" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-bold text-[hsl(var(--c-text-muted))] uppercase tracking-wider">{brand}</div>
            <div className="text-[10px] carper-mono bg-[hsl(var(--c-bg))] px-1.5 py-0.5 rounded text-[hsl(var(--c-text))]">SKU {sku}</div>
          </div>
          <Link href="/__mockup/preview/carper-a/Producto">
            <h3 className="text-sm font-medium leading-snug line-clamp-2 cursor-pointer hover:text-[hsl(var(--c-accent))]">{name}</h3>
          </Link>
          <div className="mt-auto pt-2 flex items-center justify-between">
            <div className="font-bold text-lg">{price}</div>
            <div className="text-xs font-medium text-[hsl(var(--c-success))]">En existencia</div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 pt-3 border-t border-[hsl(var(--c-border))]">
        {compatible ? (
          <div className="flex-1 flex items-center gap-1.5 bg-[hsl(var(--c-success-bg))] text-[hsl(var(--c-success))] px-2 py-1.5 rounded-lg text-xs font-medium">
            <CheckCircle2 size={14} />
            <span>Compatible con tu Tsuru</span>
          </div>
        ) : (
          <div className="flex-1"></div>
        )}
        <button className="bg-[hsl(var(--c-accent))] text-white font-medium text-sm px-4 py-1.5 rounded-lg active:scale-95 transition-transform">
          Agregar
        </button>
      </div>
    </div>
  );
}
