import { PhoneFrame } from "./_shared/PhoneFrame";
import { AppShell } from "./_shared/AppShell";
import { Car, ChevronRight, ScanBarcode, Store, Tag, BatteryCharging } from "lucide-react";
function Link({ href, children, ...props }: { href?: string; children?: any; [key: string]: any }) {
  return <a href={href} {...props}>{children}</a>;
}
import { ProductImage } from "./_shared/ProductPlaceholder";

export default function Inicio() {
  const categories = [
    "Marchas", "Sistema Eléctrico", "Inyección", "Iluminación", "Filtros", "Encendido", "Alternadores", "Enfriamiento", "Rodamientos"
  ];

  return (
    <PhoneFrame>
      <AppShell activeTab="inicio">
        <div className="flex flex-col gap-6 pb-8">
          
          {/* Saved Vehicle */}
          <div className="px-4 pt-4">
            <div className="bg-[hsl(var(--c-accent))] text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Car size={20} />
                </div>
                <div>
                  <div className="text-xs font-medium text-white/80 uppercase tracking-wider">Mi Vehículo</div>
                  <div className="font-bold">Nissan Tsuru 1.6 1992</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-white/60" />
            </div>
            <div className="mt-2 text-center">
              <button className="text-xs font-medium text-[hsl(var(--c-accent))]">Cambiar vehículo</button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="px-4 grid grid-cols-3 gap-3">
            <ActionCard icon={<ScanBarcode size={20} />} label="Escanear" />
            <ActionCard icon={<Store size={20} />} label="Recoger" />
            <ActionCard icon={<Tag size={20} />} label="Ofertas" />
          </div>

          {/* Deal of the Day */}
          <div className="px-4">
            <div className="bg-gradient-to-r from-[hsl(var(--c-text))] to-[hsl(var(--c-accent))] rounded-xl p-4 text-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-white/80 mb-1">Oferta del día</div>
                <div className="font-bold text-lg leading-tight">15% en Baterías LTH</div>
                <div className="text-xs mt-2 bg-black/20 inline-block px-2 py-1 rounded font-mono">Termina en 04:21:59</div>
              </div>
              <div className="w-16 h-16 rounded-lg border border-white/20 bg-white/10 flex items-center justify-center shrink-0">
                <BatteryCharging size={32} className="text-white" />
              </div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <div className="px-4 flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg tracking-tight">Categorías populares</h2>
              <span className="text-xs font-medium text-[hsl(var(--c-accent))]">Ver todas</span>
            </div>
            <div className="flex overflow-x-auto carper-hide-scroll px-4 gap-3 pb-2">
              {categories.map((cat, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-[72px] shrink-0">
                  <div className="w-[72px] h-[72px] bg-white border border-[hsl(var(--c-border))] rounded-2xl flex items-center justify-center shadow-sm">
                    <ProductImage alt={cat} category={cat} className="border-none w-10 h-10 bg-transparent" />
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight text-[hsl(var(--c-text-muted))]">{cat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recently Viewed */}
          <div>
            <div className="px-4 mb-3">
              <h2 className="font-bold text-lg tracking-tight">Vistos recientemente</h2>
            </div>
            <div className="px-4 flex flex-col gap-3">
              <Link href="/__mockup/preview/carper-a/Producto">
                <div className="bg-white border border-[hsl(var(--c-border))] rounded-xl p-3 flex gap-3 shadow-sm cursor-pointer active:scale-[0.98] transition-transform">
                  <ProductImage src="/__mockup/images/carper-starter.png" alt="Marcha Bosch Tsuru" className="w-20 h-20 shrink-0" />
                  <div className="flex flex-col justify-between py-0.5">
                    <div>
                      <div className="text-[10px] carper-mono text-[hsl(var(--c-text-muted))] mb-1">SKU 2740</div>
                      <div className="text-sm font-medium leading-tight line-clamp-2">MARCHA BOSCH TSURU 1.6</div>
                    </div>
                    <div className="font-bold text-[hsl(var(--c-accent))]">$1,792.33</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>

        </div>
      </AppShell>
    </PhoneFrame>
  );
}

function ActionCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="bg-white border border-[hsl(var(--c-border))] rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm">
      <div className="text-[hsl(var(--c-text))]">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
