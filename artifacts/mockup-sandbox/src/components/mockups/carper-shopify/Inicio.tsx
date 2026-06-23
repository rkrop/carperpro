import React from "react";
function Link({ href, children, ...props }: { href?: string; children?: React.ReactNode; [key: string]: any }) {
  return <a href={href} {...props}>{children}</a>;
}
import { 
  AnnouncementBar, 
  StoreHeader, 
  StoreFooter, 
  Money 
} from "./_shared/Chrome";
import { 
  Truck, 
  ShieldCheck, 
  Store, 
  MessageCircle, 
  ChevronRight, 
  ShoppingCart,
  Zap,
  Battery,
  Lightbulb,
  Filter,
  Disc,
  Droplets,
  Cpu,
  Search,
  CheckCircle2,
  Clock
} from "lucide-react";
import "./_shared/theme.css";

const CATEGORIES = [
  { name: "Marchas", icon: Zap, img: "/__mockup/images/carper-starter.png" },
  { name: "Alternadores", icon: Cpu, img: "/__mockup/images/carper-alternator.png" },
  { name: "Baterías", icon: Battery, img: "/__mockup/images/shop-battery.png" },
  { name: "Iluminación", icon: Lightbulb, img: "/__mockup/images/shop-headlight.png" },
  { name: "Filtros", icon: Filter, img: "/__mockup/images/shop-filter.png" },
  { name: "Frenos", icon: Disc, img: "/__mockup/images/shop-brake.png" },
  { name: "Inyección", icon: Droplets, img: null },
  { name: "Sistema Eléctrico", icon: Zap, img: null },
];

const PRODUCTS = [
  {
    id: 1,
    name: "Marcha Bosch Tsuru 1.6",
    sku: "2740",
    brand: "BOSCH",
    price: 1792.33,
    stock: "En existencia",
    img: "/__mockup/images/carper-starter.png",
  },
  {
    id: 2,
    name: "Alternador Valeo 90A",
    sku: "5521",
    brand: "VALEO",
    price: 2480.00,
    stock: "En existencia",
    img: "/__mockup/images/carper-alternator.png",
  },
  {
    id: 3,
    name: "Batería LTH L-42-500",
    sku: "8810",
    brand: "LTH",
    price: 2150.00,
    stock: "Pocas piezas",
    stockWarning: true,
    img: "/__mockup/images/shop-battery.png",
  },
  {
    id: 4,
    name: "Faro LED Tsuru",
    sku: "4102",
    brand: "SIN MARCA",
    price: 1340.00,
    stock: "En existencia",
    img: "/__mockup/images/shop-headlight.png",
  },
  {
    id: 5,
    name: "Filtro de aceite Fram",
    sku: "1207",
    brand: "FRAM",
    price: 189.00,
    stock: "En existencia",
    img: "/__mockup/images/shop-filter.png",
  },
  {
    id: 6,
    name: "Disco de freno Brembo",
    sku: "6033",
    brand: "BREMBO",
    price: 1090.00,
    stock: "En existencia",
    img: "/__mockup/images/shop-brake.png",
  },
];

const BRANDS = ["BOSCH", "VALEO", "LTH", "FRAM", "BREMBO", "GATES", "NGK"];

export default function Inicio() {
  return (
    <div className="carper-shop min-h-screen flex flex-col bg-[hsl(var(--c-bg))]">
      <AnnouncementBar />
      <StoreHeader cartCount={2} />
      
      <main className="flex-1 pb-20">
        {/* HERO */}
        <section 
          className="relative w-full h-[500px] flex items-center bg-[hsl(var(--c-text))]"
          style={{
            backgroundImage: 'url(/__mockup/images/shop-hero.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
          <div className="max-w-[1200px] mx-auto px-6 w-full relative z-10 flex flex-col items-start text-white">
            <h1 className="text-5xl font-bold tracking-tight mb-4 max-w-xl leading-tight">
              La pieza exacta para tu auto
            </h1>
            <p className="text-lg text-white/80 max-w-xl mb-8 leading-relaxed">
              Encuentra la refacción que buscas por vehículo, número de parte o código original. Calidad garantizada.
            </p>
            
            <div className="bg-white p-2 rounded-lg shadow-xl w-full max-w-2xl flex items-center mb-6">
              <div className="flex-1 flex px-4 items-center border-r border-gray-200">
                <Search className="w-5 h-5 text-gray-400 mr-3" />
                <input 
                  type="text" 
                  placeholder="Buscar por SKU, nombre o marca..." 
                  className="w-full bg-transparent border-none outline-none text-gray-800 h-12"
                />
              </div>
              <button className="bg-[hsl(var(--c-accent))] hover:bg-blue-700 transition-colors text-white px-8 h-12 rounded-md font-medium whitespace-nowrap ml-2">
                Buscar
              </button>
            </div>
            
            <div className="flex items-center space-x-6 text-sm font-medium text-white/90">
              <div className="flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-[hsl(var(--c-accent))]" />
                Envío a todo México
              </div>
              <div className="flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-[hsl(var(--c-accent))]" />
                Recoge en sucursal
              </div>
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="bg-white border-b border-[hsl(var(--c-border))] py-6">
          <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center justify-center space-x-3 text-[hsl(var(--c-text))]">
              <Truck className="w-6 h-6 text-[hsl(var(--c-accent))]" />
              <span className="font-medium text-sm">Envío nacional</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-[hsl(var(--c-text))]">
              <ShieldCheck className="w-6 h-6 text-[hsl(var(--c-accent))]" />
              <span className="font-medium text-sm">Pago seguro</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-[hsl(var(--c-text))]">
              <Store className="w-6 h-6 text-[hsl(var(--c-accent))]" />
              <span className="font-medium text-sm">Recoge en sucursal</span>
            </div>
            <div className="flex items-center justify-center space-x-3 text-[hsl(var(--c-text))]">
              <MessageCircle className="w-6 h-6 text-[hsl(var(--c-wa))]" />
              <span className="font-medium text-sm">Soporte por WhatsApp</span>
            </div>
          </div>
        </section>

        {/* CATEGORÍAS POPULARES */}
        <section className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[hsl(var(--c-text))]">Categorías Populares</h2>
            <Link href="/collections/all" className="text-[hsl(var(--c-accent))] hover:underline flex items-center font-medium text-sm">
              Ver todas <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CATEGORIES.map((cat, idx) => (
              <Link href={`/collections/${cat.name.toLowerCase()}`} key={idx}>
                <div className="bg-white rounded-xl border border-[hsl(var(--c-border))] p-6 flex flex-col items-center justify-center hover:border-[hsl(var(--c-accent))] hover:shadow-md transition-all cursor-pointer group">
                  <div className="w-16 h-16 rounded-full bg-[hsl(var(--c-bg))] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    {cat.img ? (
                      <img src={cat.img} alt={cat.name} className="w-10 h-10 object-contain mix-blend-multiply" />
                    ) : (
                      <cat.icon className="w-8 h-8 text-[hsl(var(--c-text-muted))]" />
                    )}
                  </div>
                  <h3 className="font-medium text-[hsl(var(--c-text))]">{cat.name}</h3>
                  <p className="text-[hsl(var(--c-accent))] text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Ver todo →</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* OFERTA DEL DÍA */}
        <section className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="rounded-2xl overflow-hidden shadow-lg bg-gradient-to-r from-[#0f172a] to-[hsl(var(--c-accent))] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between relative">
            <div className="relative z-10 text-white mb-6 md:mb-0 md:pr-8">
              <div className="inline-block bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
                Oferta del Día
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">15% de descuento en Baterías LTH</h2>
              <p className="text-white/80 mb-6 max-w-md">
                Potencia garantizada para tu vehículo con la marca líder en México. Válido solo por hoy.
              </p>
              <div className="flex items-center space-x-4">
                <button className="bg-white text-[hsl(var(--c-accent))] px-6 py-3 rounded-md font-bold hover:bg-gray-100 transition-colors">
                  Comprar ahora
                </button>
                <div className="flex items-center text-sm font-medium bg-black/20 px-4 py-2 rounded-md">
                  <Clock className="w-4 h-4 mr-2" />
                  Termina en: <span className="carper-mono ml-2 font-bold tracking-widest">08:45:12</span>
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/3 flex justify-center relative z-10">
              <img src="/__mockup/images/shop-battery.png" alt="Batería LTH" className="w-64 h-64 object-contain drop-shadow-2xl" />
            </div>
          </div>
        </section>

        {/* MÁS VENDIDOS */}
        <section className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[hsl(var(--c-text))]">Más Vendidos</h2>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {PRODUCTS.map((prod) => (
              <div key={prod.id} className="bg-white rounded-xl border border-[hsl(var(--c-border))] overflow-hidden flex flex-col hover:shadow-lg transition-shadow group">
                <div className="relative aspect-square p-6 bg-white border-b border-[hsl(var(--c-border))] flex items-center justify-center">
                  <img src={prod.img} alt={prod.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    <span className="carper-mono text-[10px] bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] text-[hsl(var(--c-text-muted))] px-2 py-1 rounded">
                      SKU {prod.sku}
                    </span>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="text-[10px] font-bold text-[hsl(var(--c-text-muted))] uppercase tracking-wider mb-2">
                    {prod.brand}
                  </div>
                  <h3 className="font-medium text-[hsl(var(--c-text))] mb-3 leading-snug hover:text-[hsl(var(--c-accent))] cursor-pointer">
                    {prod.name}
                  </h3>
                  
                  <div className="mt-auto">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xl font-bold text-[hsl(var(--c-accent))]">
                        <Money>${prod.price.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Money>
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center ${
                        prod.stockWarning 
                          ? "bg-amber-100 text-amber-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          prod.stockWarning ? "bg-amber-500" : "bg-green-500"
                        }`}></div>
                        {prod.stock}
                      </div>
                      
                      <button className="w-10 h-10 rounded-full bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] flex items-center justify-center text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-accent))] hover:text-white hover:border-[hsl(var(--c-accent))] transition-colors">
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BRAND WALL */}
        <section className="border-t border-b border-[hsl(var(--c-border))] bg-white py-12">
          <div className="max-w-[1200px] mx-auto px-6">
            <p className="text-center text-sm font-medium text-[hsl(var(--c-text-muted))] mb-8">
              TRABAJAMOS CON LAS MEJORES MARCAS DEL MERCADO
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale">
              {BRANDS.map((brand, idx) => (
                <div key={idx} className="text-xl md:text-2xl font-black tracking-tighter text-[hsl(var(--c-text))]">
                  {brand}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </div>
  );
}
