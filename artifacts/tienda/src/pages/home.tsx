import { useGetDeals, useListCategories } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ProductCard } from "@/components/product/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Wrench, Clock, ShieldCheck, Truck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { APP_URL, STORE } from "@/lib/store";
import { Button } from "@/components/ui/button";

function HeroSection() {
  return (
    <section className="relative bg-foreground text-white py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl space-y-8">
          <div className="inline-flex items-center gap-2 border border-white/20 bg-white/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-widest">
            <span className="w-2 h-2 bg-primary animate-pulse" />
            Catálogo en Línea
          </div>
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-tighter leading-[0.9]">
            PRECISIÓN EN <span className="text-primary">CADA PIEZA.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 font-medium max-w-xl">
            {STORE.tagline}. Miles de números de parte en inventario. Consulta disponibilidad al instante y pide por WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button size="lg" className="rounded-none font-bold uppercase tracking-widest" asChild>
              <Link href="/catalogo">Explorar Catálogo <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-none font-bold uppercase tracking-widest bg-transparent border-white text-white hover:bg-white hover:text-foreground" asChild>
              <Link href="/contacto">Información de Sucursal</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DealsSection() {
  const { data: deals, isLoading } = useGetDeals();

  if (isLoading) {
    return (
      <section className="py-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <Skeleton className="h-12 w-64 mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!deals || (!deals.dealOfDay && deals.ofertas.length === 0)) {
    return null;
  }

  return (
    <section className="py-24 border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {deals.dealOfDay && (
          <div className="mb-24">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-display text-3xl md:text-4xl tracking-tighter">OFERTA DEL DÍA</h2>
              <div className="h-px bg-border flex-1" />
            </div>
            <ProductCard product={deals.dealOfDay} featured />
          </div>
        )}

        {deals.ofertas.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-display text-3xl md:text-4xl tracking-tighter">OFERTAS DESTACADAS</h2>
              <div className="h-px bg-border flex-1" />
              <Link href="/catalogo" className="hidden md:flex font-mono text-sm font-bold uppercase tracking-widest text-primary hover:underline">
                Ver Todo
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {deals.ofertas.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CategoriesSection() {
  const { data: categories, isLoading } = useListCategories();

  if (isLoading) {
    return (
      <section className="py-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <Skeleton className="h-12 w-64 mb-12" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!categories || categories.length === 0) return null;

  return (
    <section className="py-24 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-12">
          <h2 className="font-display text-3xl md:text-4xl tracking-tighter">LÍNEAS DE PRODUCTOS</h2>
          <div className="h-px bg-border flex-1" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => (
            <Link 
              key={category.id} 
              href={`/catalogo?categoryId=${category.id}`}
              className="group border border-border p-6 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="font-display text-lg tracking-tight mb-2 group-hover:text-primary transition-colors">
                {category.name}
              </div>
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {category.count} items
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Wrench,
      title: "Asesoría Técnica",
      desc: "Nuestros expertos te ayudan a encontrar la pieza exacta."
    },
    {
      icon: Truck,
      title: "Entrega Rápida",
      desc: STORE.delivery.gratis ? `Envío gratis. ${STORE.delivery.eta} en ${STORE.delivery.zona}.` : "Entregas eficientes."
    },
    {
      icon: ShieldCheck,
      title: "Garantía de Calidad",
      desc: "Solo marcas reconocidas de equipo original y reemplazo."
    },
    {
      icon: Clock,
      title: "Disponibilidad Inmediata",
      desc: "Inventario en tiempo real sincronizado con mostrador."
    }
  ];

  return (
    <section className="py-24 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, i) => (
            <div key={i} className="flex flex-col border border-border p-8 bg-background">
              <feature.icon className="w-8 h-8 text-primary mb-6" />
              <h3 className="font-display text-xl tracking-tight mb-3 uppercase">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppPromoSection() {
  return (
    <section className="py-24 bg-primary text-primary-foreground overflow-hidden relative">
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-[size:20px_20px]" />
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex-1 space-y-6">
            <h2 className="font-display text-4xl md:text-6xl tracking-tighter uppercase">
              LA REFACCIONARIA EN TU BOLSILLO
            </h2>
            <p className="text-primary-foreground/80 text-lg max-w-xl">
              Descarga la aplicación móvil de Carper. Escanea piezas, guarda vehículos, arma listas de refacciones y recibe notificaciones de ofertas.
            </p>
            <div className="pt-6">
              <Button size="lg" className="rounded-none bg-white text-primary hover:bg-white/90 font-bold uppercase tracking-widest" asChild>
                <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                  Descargar Ahora
                </a>
              </Button>
            </div>
          </div>
          <div className="shrink-0 bg-white p-6 shadow-2xl rotate-3 transition-transform hover:rotate-0 duration-500">
            <QRCodeSVG value={APP_URL} size={200} level="H" />
            <div className="mt-4 text-center text-foreground font-mono text-xs font-bold uppercase tracking-widest">
              Escanea para instalar
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <DealsSection />
      <CategoriesSection />
      <FeaturesSection />
      <AppPromoSection />
    </div>
  );
}
