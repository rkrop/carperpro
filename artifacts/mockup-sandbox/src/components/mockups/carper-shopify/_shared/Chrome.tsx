import "./theme.css";
import {
  Search,
  User,
  ShoppingCart,
  Car,
  ChevronDown,
  Truck,
  Phone,
  MapPin,
  Menu,
  ShieldCheck,
} from "lucide-react";

export function CarperWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-9 h-9 rounded-lg bg-[hsl(var(--c-accent))] flex items-center justify-center shrink-0">
        <Car size={20} className="text-white" />
      </div>
      <div className="leading-none">
        <div className="font-extrabold tracking-tight text-[hsl(var(--c-text))] text-lg">
          CARPER
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--c-text-muted))]">
          Autopartes
        </div>
      </div>
    </div>
  );
}

export function AnnouncementBar() {
  return (
    <div className="bg-[hsl(var(--c-text))] text-white text-xs">
      <div className="max-w-[1200px] mx-auto px-6 h-9 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={14} className="text-white/70" />
          <span className="text-white/90">
            Envío a todo México · Recoge en sucursal sin costo
          </span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-white/70">
          <span>Paga con tarjeta · OXXO · SPEI · WhatsApp</span>
          <span className="flex items-center gap-1">
            <Phone size={12} /> Lun–Sáb 9:00–19:00
          </span>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  "Marchas",
  "Alternadores",
  "Sistema Eléctrico",
  "Inyección",
  "Iluminación",
  "Filtros",
  "Marcas",
  "Ofertas",
];

export function StoreHeader({ cartCount = 2 }: { cartCount?: number }) {
  return (
    <header className="bg-[hsl(var(--c-surface))] border-b border-[hsl(var(--c-border))] sticky top-0 z-20">
      <div className="max-w-[1200px] mx-auto px-6 py-3 flex items-center gap-5">
        <CarperWordmark />

        {/* Search with vehicle scope */}
        <div className="flex-1 max-w-[560px]">
          <div className="flex items-stretch rounded-xl border border-[hsl(var(--c-border))] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(var(--c-accent))]/30">
            <button className="flex items-center gap-2 px-3 bg-[hsl(var(--c-bg))] border-r border-[hsl(var(--c-border))] text-sm text-[hsl(var(--c-text-muted))] shrink-0">
              <Car size={16} className="text-[hsl(var(--c-accent))]" />
              <span className="hidden lg:inline font-medium text-[hsl(var(--c-text))]">
                Nissan Tsuru 1992
              </span>
              <ChevronDown size={14} />
            </button>
            <input
              className="flex-1 px-3 py-2.5 text-sm outline-none placeholder:text-[hsl(var(--c-text-muted))]"
              placeholder="Busca por pieza, SKU u OEM…"
            />
            <button className="px-4 bg-[hsl(var(--c-accent))] text-white flex items-center justify-center">
              <Search size={18} />
            </button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-bg))]">
            <User size={18} />
            <span className="hidden lg:inline font-medium">Mi cuenta</span>
          </button>
          <button className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-bg))]">
            <span className="relative">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-[hsl(var(--c-accent))] text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </span>
            <span className="hidden lg:inline">Carrito</span>
          </button>
        </div>
      </div>

      {/* Category nav */}
      <div className="border-t border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))]">
        <div className="max-w-[1200px] mx-auto px-6 h-10 flex items-center gap-1 text-sm carper-hide-scroll overflow-x-auto">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-[hsl(var(--c-text))] shrink-0">
            <Menu size={16} /> Todas las categorías
          </button>
          {NAV.map((n) => (
            <button
              key={n}
              className="px-3 py-1.5 rounded-md text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-bg))] shrink-0 whitespace-nowrap"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function PayBadges({ className = "" }: { className?: string }) {
  const pills = ["VISA", "MASTERCARD", "OXXO", "SPEI", "Mercado Pago"];
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {pills.map((p) => (
        <span
          key={p}
          className="px-2.5 py-1 rounded-md border border-[hsl(var(--c-border))] bg-white text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--c-text-muted))]"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

export function StoreFooter() {
  const cols: { title: string; items: string[] }[] = [
    { title: "Comprar", items: ["Por categoría", "Por marca", "Por vehículo", "Ofertas", "Más vendidos"] },
    { title: "Ayuda", items: ["Cómo comprar", "Envíos y entregas", "Devoluciones", "Garantías", "Contacto"] },
    { title: "Carper", items: ["Nosotros", "Sucursales", "Mayoreo", "Facturación", "Aviso de privacidad"] },
  ];
  return (
    <footer className="bg-[hsl(var(--c-surface))] border-t border-[hsl(var(--c-border))] mt-12">
      <div className="max-w-[1200px] mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <CarperWordmark />
          <p className="mt-3 text-sm text-[hsl(var(--c-text-muted))] leading-relaxed">
            Refacciones y autopartes con la pieza exacta para tu vehículo. Soporte
            real de mostrador, ahora en línea.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-[hsl(var(--c-text-muted))]">
            <MapPin size={15} /> Envíos a todo México
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-sm font-bold mb-3">{c.title}</div>
            <ul className="space-y-2 text-sm text-[hsl(var(--c-text-muted))]">
              {c.items.map((i) => (
                <li key={i} className="hover:text-[hsl(var(--c-text))] cursor-pointer">
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[hsl(var(--c-border))]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--c-text-muted))]">
            <ShieldCheck size={14} className="text-[hsl(var(--c-success))]" />
            Pago seguro · Compra protegida
          </div>
          <PayBadges />
          <div className="text-xs text-[hsl(var(--c-text-muted))]">
            © 2026 Carper Distribuidora
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Money({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums">{children}</span>;
}
