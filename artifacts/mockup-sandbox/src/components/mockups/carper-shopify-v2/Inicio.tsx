import React, { useState } from "react";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  ChevronDown,
  MapPin,
  Phone,
  Truck,
  ShieldCheck,
  Store,
  MessageCircle,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  CreditCard,
  PhoneCall,
  Mail,
  Facebook,
  Instagram,
  Twitter,
  Car
} from "lucide-react";
import "./_shared/theme.css";

const Link = ({ href = "#", children, className = "", ...props }: any) => (
  <a href={href} className={className} {...props}>
    {children}
  </a>
);

const topOffers = [
  "⚡ 15% de descuento en baterías LTH",
  "🚚 Envío gratis en compras mayores a $999 MXN",
  "💳 Hasta 6 MSI con tarjetas participantes",
  "🔧 Compra en línea, recoge en sucursal en 2 hrs",
];

const categoryTiles = [
  { name: "Marchas", count: "320", image: "/__mockup/images/carper-starter.png" },
  { name: "Alternadores", count: "145", image: "/__mockup/images/carper-alternator.png" },
  { name: "Baterías", count: "89", image: "/__mockup/images/shop-battery.png" },
  { name: "Filtros", count: "512", image: "/__mockup/images/shop-filter.png" },
  { name: "Frenos", count: "840", image: "/__mockup/images/shop-brake.png" },
  { name: "Bujías", count: "210", image: "/__mockup/images/shop-sparkplugs.png" },
  { name: "Iluminación", count: "340", image: "/__mockup/images/shop-headlight.png" },
  { name: "Balatas", count: "420", image: "/__mockup/images/shop-brakepads.png" },
  { name: "Amortiguadores", count: "290", image: "/__mockup/images/shop-shock.png" },
  { name: "Radiadores", count: "115", image: "/__mockup/images/shop-radiator.png" },
  { name: "Limpiaparabrisas", count: "85", image: "/__mockup/images/shop-wipers.png" },
  { name: "Aceites", count: "150", image: "/__mockup/images/shop-oil.png" },
];

const flashOffers = [
  { name: "Marcha Bosch Tsuru 1.6", sku: "2740", brand: "BOSCH", price: 1792.33, originalPrice: 2240.00, discount: 20, stock: 4, rating: 4.8, image: "/__mockup/images/carper-starter.png" },
  { name: "Batería LTH L-42-500", sku: "8810", brand: "LTH", price: 2150.00, originalPrice: 2500.00, discount: 14, stock: 2, rating: 4.9, image: "/__mockup/images/shop-battery.png" },
  { name: "Filtro de aceite Fram", sku: "1207", brand: "FRAM", price: 189.00, originalPrice: 240.00, discount: 21, stock: 12, rating: 4.5, image: "/__mockup/images/shop-filter.png" },
  { name: "Balatas delanteras", sku: "7740", brand: "BREMBO", price: 890.00, originalPrice: 1100.00, discount: 19, stock: 5, rating: 4.7, image: "/__mockup/images/shop-brakepads.png" },
  { name: "Aceite sintético 5W-30", sku: "1102", brand: "MOBIL", price: 420.00, originalPrice: 550.00, discount: 23, stock: 8, rating: 4.9, image: "/__mockup/images/shop-oil.png" },
  { name: "Kit de clutch", sku: "8801", brand: "VALEO", price: 3450.00, originalPrice: 4100.00, discount: 15, stock: 3, rating: 4.6, image: "/__mockup/images/shop-clutch.png" },
];

const bestSellers = [
  { name: "Alternador Valeo 90A", sku: "5521", brand: "VALEO", price: 2480.00, stock: "Disponible", rating: 4.8, compatible: true, image: "/__mockup/images/carper-alternator.png" },
  { name: "Disco de freno Brembo", sku: "6033", brand: "BREMBO", price: 1090.00, stock: "Poco stock", rating: 4.7, compatible: true, image: "/__mockup/images/shop-brake.png" },
  { name: "Amortiguador KYB", sku: "9120", brand: "KYB", price: 1250.00, stock: "Disponible", rating: 4.6, compatible: false, image: "/__mockup/images/shop-shock.png" },
  { name: "Bujías NGK (juego)", sku: "3318", brand: "NGK", price: 560.00, stock: "Disponible", rating: 4.9, compatible: true, image: "/__mockup/images/shop-sparkplugs.png" },
  { name: "Radiador Tsuru", sku: "2055", brand: "SIN MARCA", price: 2690.00, stock: "Disponible", rating: 4.2, compatible: true, image: "/__mockup/images/shop-radiator.png" },
  { name: "Faro LED Tsuru", sku: "4102", brand: "SIN MARCA", price: 1340.00, stock: "Poco stock", rating: 4.5, compatible: true, image: "/__mockup/images/shop-headlight.png" },
  { name: "Limpiaparabrisas (par)", sku: "4480", brand: "BOSCH", price: 320.00, stock: "Disponible", rating: 4.4, compatible: false, image: "/__mockup/images/shop-wipers.png" },
  { name: "Kit distribución Gates", sku: "6677", brand: "GATES", price: 1980.00, stock: "Disponible", rating: 4.8, compatible: true, image: "/__mockup/images/shop-timingbelt.png" },
  { name: "Filtro de aire", sku: "1330", brand: "FRAM", price: 240.00, stock: "Disponible", rating: 4.6, compatible: true, image: "/__mockup/images/shop-airfilter.png" },
  { name: "Balatas delanteras", sku: "7740", brand: "BREMBO", price: 890.00, stock: "Disponible", rating: 4.7, compatible: true, image: "/__mockup/images/shop-brakepads.png" },
];

const newArrivals = [
  { name: "Faro de Niebla LED", sku: "4105", brand: "HELLA", price: 1250.00, stock: "Nuevo", rating: 5.0, compatible: true, image: "/__mockup/images/shop-headlight.png" },
  { name: "Batería Óptima YellowTop", sku: "8822", brand: "OPTIMA", price: 4500.00, stock: "Nuevo", rating: 4.9, compatible: false, image: "/__mockup/images/shop-battery.png" },
  { name: "Bomba de Agua", sku: "3311", brand: "ACDELCO", price: 850.00, stock: "Nuevo", rating: 4.5, compatible: true, image: "/__mockup/images/shop-radiator.png" },
  { name: "Balatas Traseras Cerámicas", sku: "7745", brand: "WAGNER", price: 720.00, stock: "Nuevo", rating: 4.7, compatible: true, image: "/__mockup/images/shop-brakepads.png" },
  { name: "Amortiguador Gas-a-Just", sku: "9125", brand: "KYB", price: 1450.00, stock: "Nuevo", rating: 4.8, compatible: false, image: "/__mockup/images/shop-shock.png" },
];

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
};

export default function Inicio() {
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);

  return (
    <div className="carper-shop bg-[hsl(var(--c-bg))] min-h-screen text-[hsl(var(--c-text))] font-sans flex flex-col">
      
      {/* 1. TOP UTILITY BAR */}
      <div className="bg-[hsl(var(--c-ink))] text-white text-xs font-medium relative overflow-hidden">
        <div className="container mx-auto px-4 flex justify-between items-center py-1 relative z-10">
          <div className="hidden md:flex items-center gap-4">
            <span className="flex items-center gap-1"><Truck size={14} className="text-[hsl(var(--c-accent))]" /> Envío Nacional</span>
            <span className="flex items-center gap-1"><CreditCard size={14} className="text-[hsl(var(--c-accent))]" /> Tarjeta · OXXO · SPEI</span>
            <span className="flex items-center gap-1"><MessageCircle size={14} className="text-[hsl(var(--c-wa))]" /> WhatsApp: 55 1234 5678</span>
          </div>
          <div className="flex-1 md:flex-none overflow-hidden max-w-full md:max-w-md">
            <div className="carper-marquee whitespace-nowrap inline-block animate-[marquee_15s_linear_infinite]">
              {topOffers.map((offer, i) => (
                <span key={i} className="mx-4">{offer}</span>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            <Clock size={14} className="text-[hsl(var(--c-accent))]" /> Lunes a Sábado 9:00 - 18:00
          </div>
        </div>
      </div>

      {/* 2. HEADER */}
      <header className="bg-white border-b border-[hsl(var(--c-border))] sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-10 h-10 bg-[hsl(var(--c-accent))] rounded-xl flex items-center justify-center text-white">
                <Car size={24} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl leading-none tracking-tight">CARPER</span>
                <span className="text-[0.65rem] font-bold tracking-widest text-[hsl(var(--c-text-muted))]">AUTOPARTES</span>
              </div>
            </Link>

            {/* Search & Vehicle Selector */}
            <div className="flex-1 w-full flex">
              <div className="flex w-full border-2 border-[hsl(var(--c-accent))] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(var(--c-accent))]/30 transition-all bg-white">
                <button className="flex items-center gap-2 bg-[hsl(var(--c-bg))] px-3 py-2 border-r border-[hsl(var(--c-border))] text-sm font-medium hover:bg-gray-100 transition-colors whitespace-nowrap">
                  <Car size={16} className="text-[hsl(var(--c-text-muted))]" />
                  <span className="hidden sm:inline">Nissan Tsuru 1992</span>
                  <ChevronDown size={14} />
                </button>
                <input 
                  type="text" 
                  placeholder="Buscar por OEM, SKU o pieza..." 
                  className="flex-1 px-4 py-2 outline-none text-sm placeholder:text-[hsl(var(--c-text-muted))]"
                />
                <button className="bg-[hsl(var(--c-accent))] text-white px-5 flex items-center justify-center hover:bg-blue-700 transition-colors">
                  <Search size={18} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-6 shrink-0">
              <Link href="#" className="flex flex-col items-center text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-accent))] transition-colors">
                <User size={22} />
                <span className="text-[0.65rem] font-medium mt-1">Mi Cuenta</span>
              </Link>
              <Link href="#" className="flex flex-col items-center text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-accent))] transition-colors relative">
                <div className="relative">
                  <ShoppingCart size={22} />
                  <span className="absolute -top-2 -right-2 bg-[hsl(var(--c-danger))] text-white text-[0.6rem] font-bold w-4 h-4 rounded-full flex items-center justify-center">3</span>
                </div>
                <span className="text-[0.65rem] font-medium mt-1">Carrito</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Category Nav */}
        <nav className="border-t border-[hsl(var(--c-border))] bg-white relative">
          <div className="container mx-auto px-4">
            <ul className="flex items-center gap-6 overflow-x-auto no-scrollbar text-sm font-medium text-[hsl(var(--c-text-muted))]">
              <li className="relative group">
                <button 
                  className="flex items-center gap-1 py-3 text-[hsl(var(--c-text))] border-b-2 border-[hsl(var(--c-accent))] hover:text-[hsl(var(--c-accent))] transition-colors whitespace-nowrap"
                  onMouseEnter={() => setMegaMenuOpen(true)}
                  onMouseLeave={() => setMegaMenuOpen(false)}
                >
                  <Menu size={16} /> Todos los Departamentos <ChevronDown size={14} />
                </button>
                
                {/* Mega Menu Dropdown */}
                {megaMenuOpen && (
                  <div 
                    className="absolute top-full left-0 w-[800px] bg-white border border-[hsl(var(--c-border))] shadow-xl rounded-b-lg p-6 grid grid-cols-4 gap-6 z-50"
                    onMouseEnter={() => setMegaMenuOpen(true)}
                    onMouseLeave={() => setMegaMenuOpen(false)}
                  >
                    <div>
                      <h4 className="font-bold text-[hsl(var(--c-text))] mb-3 pb-2 border-b border-[hsl(var(--c-border))]">Motor y Partes</h4>
                      <ul className="space-y-2 text-sm">
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Bandas de Distribución</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Soportes de Motor</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Empaques y Juntas</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Bombas de Aceite</Link></li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--c-text))] mb-3 pb-2 border-b border-[hsl(var(--c-border))]">Sistema Eléctrico</h4>
                      <ul className="space-y-2 text-sm">
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Marchas y Alternadores</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Baterías</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Sensores y Válvulas</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Bujías y Cables</Link></li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--c-text))] mb-3 pb-2 border-b border-[hsl(var(--c-border))]">Suspensión y Dirección</h4>
                      <ul className="space-y-2 text-sm">
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Amortiguadores</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Horquillas y Rótulas</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Terminales</Link></li>
                        <li><Link href="#" className="hover:text-[hsl(var(--c-accent))] transition-colors">Bujes y Gomas</Link></li>
                      </ul>
                    </div>
                    <div className="bg-[hsl(var(--c-bg))] p-4 rounded-lg flex flex-col justify-center items-center text-center">
                      <div className="text-[hsl(var(--c-accent))] mb-2"><Zap size={24} /></div>
                      <h5 className="font-bold mb-1">Ofertas de Temporada</h5>
                      <p className="text-xs text-[hsl(var(--c-text-muted))] mb-3">Hasta 40% OFF en frenos y afinación</p>
                      <button className="text-xs bg-[hsl(var(--c-ink))] text-white px-4 py-1.5 rounded-full font-medium hover:bg-black transition-colors w-full">Ver Ofertas</button>
                    </div>
                  </div>
                )}
              </li>
              <li><Link href="#" className="py-3 hover:text-[hsl(var(--c-accent))] transition-colors whitespace-nowrap block">Marcas Principales</Link></li>
              <li><Link href="#" className="py-3 text-[hsl(var(--c-danger))] font-bold hover:text-red-700 transition-colors whitespace-nowrap block flex items-center gap-1"><Zap size={14}/> Ofertas Flash</Link></li>
              <li><Link href="#" className="py-3 hover:text-[hsl(var(--c-accent))] transition-colors whitespace-nowrap block">Nuevos Ingresos</Link></li>
              <li><Link href="#" className="py-3 hover:text-[hsl(var(--c-accent))] transition-colors whitespace-nowrap block">Catálogo OEM</Link></li>
              <li><Link href="#" className="py-3 hover:text-[hsl(var(--c-accent))] transition-colors whitespace-nowrap block">Ayuda y Soporte</Link></li>
            </ul>
          </div>
        </nav>
      </header>

      <main className="flex-1 pb-12">
        {/* 3. HERO */}
        <section className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Hero */}
            <div className="lg:col-span-2 relative rounded-2xl overflow-hidden bg-[hsl(var(--c-ink))] h-[400px] shadow-lg group">
              <img 
                src="/__mockup/images/shop-hero.png" 
                alt="Carper Hero" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--c-ink))] to-transparent"></div>
              <div className="absolute inset-0 p-8 flex flex-col justify-center">
                <span className="inline-block bg-[hsl(var(--c-accent))] text-white text-xs font-bold px-3 py-1 rounded-full w-max mb-4 uppercase tracking-wider">Catálogo 2026</span>
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 max-w-lg leading-tight">
                  La pieza exacta,<br />al instante.
                </h1>
                <p className="text-gray-300 mb-8 max-w-md text-lg">
                  Más de 50,000 refacciones en stock con envío inmediato a todo México.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button className="bg-[hsl(var(--c-accent))] text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                    Buscar mi vehículo <ArrowRight size={18} />
                  </button>
                  <button className="bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors">
                    Ver Catálogo Completo
                  </button>
                </div>
              </div>
            </div>

            {/* Side Promos */}
            <div className="flex flex-col gap-4 h-[400px]">
              <Link href="#" className="relative flex-1 rounded-2xl overflow-hidden bg-gray-900 group shadow-md block">
                <img 
                  src="/__mockup/images/shop-promo-wide.png" 
                  alt="Promo Frenos" 
                  className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-5">
                  <span className="text-[hsl(var(--c-danger))] font-black text-xl leading-none">HASTA 30%</span>
                  <h3 className="text-white font-bold text-lg leading-tight mt-1">En sistema de frenos</h3>
                  <span className="text-white/80 text-sm flex items-center gap-1 mt-2 group-hover:text-white transition-colors">Comprar ahora <ArrowRight size={14} /></span>
                </div>
              </Link>
              <Link href="#" className="relative flex-1 rounded-2xl overflow-hidden bg-gray-900 group shadow-md block">
                <img 
                  src="/__mockup/images/shop-hero.png" 
                  alt="Envío Gratis" 
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"></div>
                <div className="absolute bottom-0 left-0 p-5 w-full flex justify-between items-end">
                  <div>
                    <h3 className="text-white font-bold text-xl leading-tight">Envío Gratis</h3>
                    <p className="text-gray-300 text-sm mt-1">En compras +$999 MXN</p>
                  </div>
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                    <Truck size={20} />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* 4. TRUST STRIP */}
        <section className="container mx-auto px-4 py-4">
          <div className="bg-white rounded-xl border border-[hsl(var(--c-border))] p-6 shadow-sm flex flex-wrap justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--c-bg))] flex items-center justify-center text-[hsl(var(--c-accent))]">
                <Truck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-[hsl(var(--c-text))] leading-none mb-1">Envío Nacional</h4>
                <p className="text-sm text-[hsl(var(--c-text-muted))]">Rápido y seguro</p>
              </div>
            </div>
            <div className="w-px h-10 bg-[hsl(var(--c-border))] hidden md:block"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--c-bg))] flex items-center justify-center text-[hsl(var(--c-success))]">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-[hsl(var(--c-text))] leading-none mb-1">Pago 100% Seguro</h4>
                <p className="text-sm text-[hsl(var(--c-text-muted))]">Encriptación SSL</p>
              </div>
            </div>
            <div className="w-px h-10 bg-[hsl(var(--c-border))] hidden lg:block"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--c-bg))] flex items-center justify-center text-[hsl(var(--c-warning))]">
                <Store size={24} />
              </div>
              <div>
                <h4 className="font-bold text-[hsl(var(--c-text))] leading-none mb-1">Recoge en Sucursal</h4>
                <p className="text-sm text-[hsl(var(--c-text-muted))]">Listo en 2 horas</p>
              </div>
            </div>
            <div className="w-px h-10 bg-[hsl(var(--c-border))] hidden xl:block"></div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366]">
                <MessageCircle size={24} />
              </div>
              <div>
                <h4 className="font-bold text-[hsl(var(--c-text))] leading-none mb-1">Soporte WhatsApp</h4>
                <p className="text-sm text-[hsl(var(--c-text-muted))]">Lunes a Sábado</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. CATEGORÍAS */}
        <section className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[hsl(var(--c-text))]">Explora por Categoría</h2>
              <p className="text-[hsl(var(--c-text-muted))] mt-1">Encuentra exactamente lo que necesitas</p>
            </div>
            <Link href="#" className="text-[hsl(var(--c-accent))] font-medium text-sm hover:underline flex items-center gap-1 hidden sm:flex">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categoryTiles.map((cat, i) => (
              <Link key={i} href="#" className="bg-white border border-[hsl(var(--c-border))] rounded-xl p-4 flex flex-col items-center text-center hover:shadow-md hover:border-[hsl(var(--c-accent))]/30 transition-all group">
                <div className="w-20 h-20 mb-3 bg-[hsl(var(--c-bg))] rounded-full p-3 group-hover:bg-blue-50 transition-colors">
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-contain mix-blend-multiply" />
                </div>
                <h3 className="font-bold text-sm text-[hsl(var(--c-text))] group-hover:text-[hsl(var(--c-accent))] transition-colors">{cat.name}</h3>
                <p className="text-xs text-[hsl(var(--c-text-muted))] mt-1">{cat.count} piezas</p>
              </Link>
            ))}
          </div>
        </section>

        {/* 6. OFERTAS FLASH */}
        <section className="container mx-auto px-4 py-8">
          <div className="bg-[hsl(var(--c-danger))]/5 border border-[hsl(var(--c-danger))]/20 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[hsl(var(--c-danger))] rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                  <Zap size={24} fill="currentColor" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[hsl(var(--c-danger))] uppercase tracking-tight">Ofertas Flash</h2>
                  <p className="text-[hsl(var(--c-text))] font-medium">Precios especiales por tiempo limitado</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-[hsl(var(--c-danger))]/20 shadow-sm">
                <Clock size={18} className="text-[hsl(var(--c-danger))]" />
                <span className="text-sm font-medium text-[hsl(var(--c-text-muted))]">Termina en:</span>
                <span className="carper-mono font-bold text-lg text-[hsl(var(--c-text))] tracking-wider">04:28:15</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {flashOffers.map((product, i) => (
                <div key={i} className="bg-white rounded-xl border border-[hsl(var(--c-border))] p-4 relative flex flex-col hover:shadow-xl transition-all group">
                  <div className="absolute top-3 right-3 bg-[hsl(var(--c-danger))] text-white text-xs font-bold px-2 py-1 rounded z-10 shadow-sm">
                    -{product.discount}%
                  </div>
                  <Link href="#" className="block mb-4 relative aspect-square overflow-hidden rounded-lg bg-[hsl(var(--c-bg))]">
                    <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-4 mix-blend-multiply group-hover:scale-110 transition-transform duration-500" />
                  </Link>
                  <div className="flex-1 flex flex-col">
                    <div className="text-[0.65rem] font-bold text-[hsl(var(--c-text-muted))] mb-1 flex justify-between items-center">
                      <span>{product.brand}</span>
                      <span className="carper-mono bg-gray-100 px-1.5 py-0.5 rounded">{product.sku}</span>
                    </div>
                    <Link href="#" className="font-semibold text-sm leading-tight text-[hsl(var(--c-text))] hover:text-[hsl(var(--c-accent))] line-clamp-2 mb-2 flex-1">
                      {product.name}
                    </Link>
                    <div className="flex items-center gap-1 mb-3">
                      <div className="flex text-amber-400">
                        <Star size={12} fill="currentColor" />
                      </div>
                      <span className="text-xs text-[hsl(var(--c-text-muted))]">{product.rating}</span>
                    </div>
                    <div className="mb-3">
                      <div className="text-xs text-[hsl(var(--c-text-muted))] line-through mb-0.5">{formatMoney(product.originalPrice)}</div>
                      <div className="text-lg font-black text-[hsl(var(--c-danger))] leading-none">{formatMoney(product.price)}</div>
                    </div>
                    <div className="mt-auto">
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5 overflow-hidden">
                        <div className="bg-[hsl(var(--c-danger))] h-full rounded-full" style={{ width: `${(product.stock / 20) * 100}%` }}></div>
                      </div>
                      <div className="text-[0.65rem] text-[hsl(var(--c-danger))] font-medium mb-3">Quedan {product.stock} unidades</div>
                      <button className="w-full bg-[hsl(var(--c-ink))] text-white font-medium py-2 rounded-lg text-sm hover:bg-black transition-colors flex items-center justify-center gap-2">
                        <ShoppingCart size={16} /> Agregar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. MÁS VENDIDOS */}
        <section className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-end mb-6 border-b border-[hsl(var(--c-border))] pb-4">
            <div>
              <h2 className="text-2xl font-bold text-[hsl(var(--c-text))]">Más Vendidos</h2>
              <p className="text-[hsl(var(--c-text-muted))] mt-1">Los favoritos de nuestros clientes</p>
            </div>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full border border-[hsl(var(--c-border))] flex items-center justify-center hover:bg-gray-50"><ChevronDown className="rotate-90" size={16} /></button>
              <button className="w-8 h-8 rounded-full border border-[hsl(var(--c-border))] flex items-center justify-center hover:bg-gray-50"><ChevronDown className="-rotate-90" size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {bestSellers.map((product, i) => (
              <div key={i} className="bg-white rounded-xl border border-[hsl(var(--c-border))] p-4 flex flex-col hover:shadow-lg hover:border-[hsl(var(--c-accent))]/50 transition-all group">
                <Link href="#" className="block mb-4 relative aspect-square overflow-hidden rounded-lg bg-[hsl(var(--c-bg))]">
                  {product.compatible && (
                    <div className="absolute top-2 left-2 bg-[hsl(var(--c-success))] text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
                      <CheckCircle2 size={10} /> Compatible
                    </div>
                  )}
                  <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-4 mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="text-[0.65rem] font-bold text-[hsl(var(--c-text-muted))] mb-1 flex justify-between items-center">
                    <span>{product.brand}</span>
                    <span className="carper-mono bg-gray-100 px-1.5 py-0.5 rounded text-[0.6rem]">{product.sku}</span>
                  </div>
                  <Link href="#" className="font-semibold text-sm leading-snug text-[hsl(var(--c-text))] hover:text-[hsl(var(--c-accent))] line-clamp-2 mb-2 flex-1">
                    {product.name}
                  </Link>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-amber-400" fill="currentColor" />
                      <span className="text-xs font-medium text-[hsl(var(--c-text-muted))]">{product.rating}</span>
                    </div>
                    <span className={`text-[0.65rem] font-medium px-2 py-0.5 rounded-full ${
                      product.stock === "Disponible" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {product.stock}
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-[hsl(var(--c-border))]">
                    <div className="text-lg font-bold text-[hsl(var(--c-accent))]">{formatMoney(product.price)}</div>
                    <button className="w-8 h-8 rounded-full bg-[hsl(var(--c-bg))] text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-accent))] hover:text-white flex items-center justify-center transition-colors shrink-0">
                      <ShoppingCart size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 8. PROMO BANNER */}
        <section className="container mx-auto px-4 py-8">
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 h-[250px] shadow-lg group">
            <img 
              src="/__mockup/images/shop-promo-wide.png" 
              alt="Promo Especial" 
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-transparent"></div>
            <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-center max-w-2xl">
              <span className="inline-block bg-white text-[hsl(var(--c-ink))] text-xs font-bold px-3 py-1 rounded-full w-max mb-3 uppercase tracking-wider">Profesionales del volante</span>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3">¿Tienes un taller mecánico?</h2>
              <p className="text-gray-200 mb-6 text-lg">Regístrate como mayorista y obtén hasta un 40% de descuento en tus compras, crédito disponible y atención personalizada.</p>
              <button className="bg-[hsl(var(--c-accent))] text-white font-bold px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors w-max">
                Solicitar cuenta Mayorista
              </button>
            </div>
          </div>
        </section>

        {/* 9. NUEVOS INGRESOS */}
        <section className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[hsl(var(--c-text))]">Nuevos Ingresos</h2>
              <p className="text-[hsl(var(--c-text-muted))] mt-1">Lo más reciente en nuestro catálogo</p>
            </div>
            <Link href="#" className="text-[hsl(var(--c-accent))] font-medium text-sm hover:underline flex items-center gap-1 hidden sm:flex">
              Ver catálogo <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {newArrivals.map((product, i) => (
              <div key={i} className="bg-white rounded-xl border border-[hsl(var(--c-border))] p-4 flex flex-col hover:shadow-lg transition-all group">
                <Link href="#" className="block mb-4 relative aspect-square overflow-hidden rounded-lg bg-[hsl(var(--c-bg))]">
                  <div className="absolute top-2 left-2 bg-[hsl(var(--c-accent))] text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full z-10">
                    NUEVO
                  </div>
                  <img src={product.image} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-4 mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="text-[0.65rem] font-bold text-[hsl(var(--c-text-muted))] mb-1 flex justify-between items-center">
                    <span>{product.brand}</span>
                    <span className="carper-mono bg-gray-100 px-1.5 py-0.5 rounded text-[0.6rem]">{product.sku}</span>
                  </div>
                  <Link href="#" className="font-semibold text-sm leading-snug text-[hsl(var(--c-text))] hover:text-[hsl(var(--c-accent))] line-clamp-2 mb-2 flex-1">
                    {product.name}
                  </Link>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-[hsl(var(--c-border))] mt-3">
                    <div className="text-lg font-bold text-[hsl(var(--c-text))]">{formatMoney(product.price)}</div>
                    <button className="w-8 h-8 rounded-full bg-[hsl(var(--c-bg))] text-[hsl(var(--c-text))] hover:bg-[hsl(var(--c-accent))] hover:text-white flex items-center justify-center transition-colors shrink-0">
                      <ShoppingCart size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 10. POR MARCA */}
        <section className="container mx-auto px-4 py-8 bg-white border-y border-[hsl(var(--c-border))] mt-8">
          <h2 className="text-center text-xl font-bold text-[hsl(var(--c-text))] mb-8">Nuestras Marcas de Confianza</h2>
          
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-8">
            {["BOSCH", "VALEO", "LTH", "FRAM", "BREMBO", "NGK", "KYB", "GATES", "MOBIL", "ACDELCO", "HELLA", "WAGNER"].map((brand, i) => (
              <div key={i} className="px-6 py-3 bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] rounded-lg font-black text-gray-400 hover:text-[hsl(var(--c-text))] hover:border-gray-300 transition-colors cursor-pointer text-lg tracking-wider">
                {brand}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <Link href="#" className="bg-[hsl(var(--c-ink))] text-white rounded-xl p-6 relative overflow-hidden group">
              <div className="absolute -right-10 -bottom-10 opacity-10">
                <Zap size={150} />
              </div>
              <h3 className="text-xl font-bold mb-2">Especialistas Eléctricos</h3>
              <p className="text-gray-400 text-sm mb-4">Todo en marchas, alternadores y sensores de las mejores marcas.</p>
              <span className="text-[hsl(var(--c-accent))] font-medium text-sm flex items-center gap-1 group-hover:translate-x-2 transition-transform">Ver refacciones <ArrowRight size={14} /></span>
            </Link>
            <Link href="#" className="bg-[hsl(var(--c-bg))] text-[hsl(var(--c-text))] rounded-xl p-6 relative overflow-hidden group border border-[hsl(var(--c-border))]">
              <h3 className="text-xl font-bold mb-2 text-[hsl(var(--c-danger))]">Boutique de Frenos</h3>
              <p className="text-[hsl(var(--c-text-muted))] text-sm mb-4">Balatas, discos y líquidos para máxima seguridad.</p>
              <span className="font-medium text-sm flex items-center gap-1 group-hover:translate-x-2 transition-transform">Ver refacciones <ArrowRight size={14} /></span>
            </Link>
            <Link href="#" className="bg-[hsl(var(--c-bg))] text-[hsl(var(--c-text))] rounded-xl p-6 relative overflow-hidden group border border-[hsl(var(--c-border))]">
              <h3 className="text-xl font-bold mb-2 text-[hsl(var(--c-success))]">Mantenimiento</h3>
              <p className="text-[hsl(var(--c-text-muted))] text-sm mb-4">Kits de afinación, filtros y aceites sintéticos.</p>
              <span className="font-medium text-sm flex items-center gap-1 group-hover:translate-x-2 transition-transform">Ver refacciones <ArrowRight size={14} /></span>
            </Link>
          </div>
        </section>

        {/* 11. BENEFICIOS */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center md:text-left">
              <div className="w-12 h-12 bg-blue-50 text-[hsl(var(--c-accent))] rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Garantía Directa</h3>
              <p className="text-sm text-[hsl(var(--c-text-muted))]">Todas nuestras refacciones cuentan con garantía de fábrica y devoluciones sin complicaciones.</p>
            </div>
            <div className="text-center md:text-left">
              <div className="w-12 h-12 bg-blue-50 text-[hsl(var(--c-accent))] rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <PhoneCall size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Soporte de Mostrador</h3>
              <p className="text-sm text-[hsl(var(--c-text-muted))]">¿Dudas de compatibilidad? Nuestro equipo de expertos te asesora antes de tu compra.</p>
            </div>
            <div className="text-center md:text-left">
              <div className="w-12 h-12 bg-blue-50 text-[hsl(var(--c-accent))] rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <Truck size={24} />
              </div>
              <h3 className="font-bold text-lg mb-2">Envíos Rápidos</h3>
              <p className="text-sm text-[hsl(var(--c-text-muted))]">Despachamos el mismo día. Alianzas con DHL, Estafeta y FedEx para todo México.</p>
            </div>
            <div className="text-center md:text-left">
              <div className="w-12 h-12 bg-blue-50 text-[hsl(var(--c-accent))] rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              </div>
              <h3 className="font-bold text-lg mb-2">Facturación Electrónica</h3>
              <p className="text-sm text-[hsl(var(--c-text-muted))]">Genera tu factura CFDI 4.0 al instante desde tu panel de control sin demoras.</p>
            </div>
          </div>
        </section>
      </main>

      {/* 12. FOOTER */}
      <footer className="bg-[hsl(var(--c-ink))] text-white pt-16 pb-8 border-t-[8px] border-[hsl(var(--c-accent))]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-[hsl(var(--c-accent))] rounded-lg flex items-center justify-center text-white">
                  <Car size={18} />
                </div>
                <span className="font-bold text-xl tracking-tight">CARPER</span>
              </div>
              <p className="text-gray-400 text-sm mb-6 max-w-xs">
                El proveedor líder de autopartes en México. Calidad, precio y servicio de mostrador, ahora en línea.
              </p>
              <div className="flex gap-4">
                <Link href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[hsl(var(--c-accent))] transition-colors"><Facebook size={18} /></Link>
                <Link href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[hsl(var(--c-accent))] transition-colors"><Instagram size={18} /></Link>
                <Link href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[hsl(var(--c-accent))] transition-colors"><Twitter size={18} /></Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-lg mb-6">Comprar</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Ofertas Flash</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Catálogo por Marca</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Búsqueda por Vehículo</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Nuevos Ingresos</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Cotizador para Talleres</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-6">Soporte</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-white transition-colors">Mi Cuenta</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Rastrear mi Pedido</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Garantías y Devoluciones</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Preguntas Frecuentes</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Facturación</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-6">Contacto</h4>
              <ul className="space-y-4 text-sm text-gray-400">
                <li className="flex items-start gap-3">
                  <MapPin size={18} className="text-[hsl(var(--c-accent))] shrink-0 mt-0.5" />
                  <span>Av. Central 123, Col. Industrial, CDMX, C.P. 01234</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={18} className="text-[hsl(var(--c-accent))] shrink-0" />
                  <span>55 1234 5678 (Lunes a Sábado)</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail size={18} className="text-[hsl(var(--c-accent))] shrink-0" />
                  <span>ventas@carperautopartes.mx</span>
                </li>
              </ul>
              
              <div className="mt-6 bg-white/5 p-4 rounded-xl border border-white/10">
                <h5 className="font-medium text-sm mb-2 text-white flex items-center gap-2">
                  <MessageCircle size={16} className="text-[#25D366]" /> Chat de WhatsApp
                </h5>
                <p className="text-xs text-gray-400 mb-3">Respuesta en menos de 5 minutos</p>
                <button className="w-full bg-[#25D366] text-[hsl(var(--c-ink))] font-bold py-2 rounded text-sm hover:bg-[#1ebd5a] transition-colors">
                  Enviar Mensaje
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2026 Carper Distribuidora. Todos los derechos reservados.
            </p>
            <div className="flex gap-2 text-gray-400 opacity-50 text-xs font-bold items-center">
              <span className="px-2 border border-gray-600 rounded">VISA</span>
              <span className="px-2 border border-gray-600 rounded">MASTERCARD</span>
              <span className="px-2 border border-gray-600 rounded">OXXO</span>
              <span className="px-2 border border-gray-600 rounded">SPEI</span>
              <span className="px-2 border border-gray-600 rounded">MERCADO PAGO</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
