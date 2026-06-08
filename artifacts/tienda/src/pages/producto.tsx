import { useRoute } from "wouter";
import { useGetProduct } from "@workspace/api-client-react";
import { getGetProductQueryKey } from "@workspace/api-client-react";
import { ProductPlaceholder } from "@/components/product/ProductPlaceholder";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { whatsappUrl } from "@/lib/store";
import { MessageCircle, Check, Info } from "lucide-react";
import NotFound from "./not-found";
import { useSeo, productJsonLd, breadcrumbJsonLd } from "@/lib/seo";

// "2003–2010" / "2003" / "—" from an inclusive year range.
function formatYears(from: number | null | undefined, to: number | null | undefined): string {
  if (from && to) return from === to ? String(from) : `${from}–${to}`;
  if (from) return String(from);
  if (to) return String(to);
  return "—";
}

export default function Producto() {
  const [, params] = useRoute("/producto/:id");
  const id = params?.id;

  const { data: product, isLoading, error } = useGetProduct(id!, undefined, {
    query: {
      enabled: !!id,
      queryKey: getGetProductQueryKey(id!)
    }
  });

  const productPath = `/producto/${id ?? ""}`;
  const seoPriceFormatter = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  useSeo(
    product
      ? {
          title: `${product.name} | Carper Autopartes`,
          description:
            (product.descripcion?.trim() ||
              `${product.name}${product.brand && product.brand !== "SIN MARCA" ? ` ${product.brand}` : ""}. SKU ${product.sku}. ${product.quoteOnly ? "Precio a consultar" : seoPriceFormatter.format(product.price)}. Disponible en Carper Autopartes, Ciudad Obregón. Consulta disponibilidad y pide por WhatsApp.`).slice(
              0,
              300,
            ),
          path: productPath,
          image: product.image ?? undefined,
          type: "product",
          jsonLd: [
            productJsonLd({
              name: product.name,
              sku: product.sku,
              brand: product.brand,
              price: product.price,
              quoteOnly: product.quoteOnly,
              image: product.image,
              description: product.descripcion,
              inStock: product.stock !== 0,
              oem: product.oem,
              path: productPath,
            }),
            breadcrumbJsonLd([
              { name: "Inicio", path: "/" },
              { name: "Catálogo", path: "/catalogo" },
              { name: product.name, path: productPath },
            ]),
          ],
        }
      : {
          title: "Producto | Carper Autopartes",
          path: productPath,
          noindex: true,
        },
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row gap-12">
          <Skeleton className="w-full md:w-1/2 aspect-square" />
          <div className="w-full md:w-1/2 space-y-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-16 w-3/4" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return <NotFound />;
  }

  // Three availability states: in stock (>0), confirmed out (0), unknown (null).
  const agotado = product.stock === 0;
  const enExistencia = typeof product.stock === "number" && product.stock > 0;
  const priceFormatter = new Intl.NumberFormat('es-MX', { 
    style: 'currency', 
    currency: 'MXN' 
  });

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-16">
        <div className="flex flex-col md:flex-row gap-12 lg:gap-24">
          
          {/* Image Section */}
          <div className="w-full md:w-1/2">
            <div className="aspect-square border border-border bg-card relative">
              {product.image ? (
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-contain p-8"
                />
              ) : (
                <ProductPlaceholder name={product.name} />
              )}
              
              {product.brand && (
                <div className="absolute top-6 left-6 bg-foreground text-white text-xs font-mono font-bold uppercase tracking-widest px-3 py-1">
                  {product.brand}
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="w-full md:w-1/2 flex flex-col">
            <div className="mb-4">
              <span className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
                SKU: {product.sku}
              </span>
            </div>
            
            <h1 className="font-display text-3xl md:text-5xl tracking-tighter uppercase mb-6 leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-4 mb-8">
              {enExistencia ? (
                <div className="flex items-center text-success font-mono font-bold text-sm uppercase tracking-widest">
                  <Check className="w-4 h-4 mr-2" /> {product.stock} disponibles en tienda
                </div>
              ) : agotado ? (
                <div className="flex items-center text-muted-foreground font-mono font-bold text-sm uppercase tracking-widest">
                  <Info className="w-4 h-4 mr-2" /> Agotado temporalmente
                </div>
              ) : (
                <div className="flex items-center text-muted-foreground font-mono font-bold text-sm uppercase tracking-widest">
                  <Info className="w-4 h-4 mr-2" /> Consultar disponibilidad
                </div>
              )}
            </div>

            <div className="mb-10">
              {product.quoteOnly ? (
                <>
                  <span className="font-mono text-3xl font-bold text-foreground uppercase tracking-tight">
                    Precio a consultar
                  </span>
                  <p className="text-xs text-muted-foreground mt-2 font-mono uppercase tracking-widest">Cotiza precio y disponibilidad por WhatsApp.</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-4xl font-bold text-foreground">
                      {priceFormatter.format(product.price)}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="font-mono text-xl text-muted-foreground line-through">
                        {priceFormatter.format(product.originalPrice)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-mono uppercase tracking-widest">Precios con IVA incluido. Sujetos a cambio.</p>
                </>
              )}
            </div>

            <div className="bg-card border border-border p-6 mb-10">
              <h3 className="font-display text-lg mb-4 uppercase">{product.quoteOnly ? "¿Te cotizamos esta pieza?" : "¿Necesitas esta pieza?"}</h3>
              <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
                {product.quoteOnly
                  ? "Esta pieza se maneja bajo cotización. Escríbele a un asesor por WhatsApp para conocer precio y disponibilidad, confirmar compatibilidad con tu vehículo y coordinar la entrega o recolección."
                  : "Contacta a un asesor de ventas por WhatsApp para confirmar compatibilidad exacta con tu vehículo, revisar métodos de pago y coordinar la entrega o recolección."}
              </p>
              <Button size="lg" className="w-full rounded-none font-bold uppercase tracking-widest gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-transparent" asChild>
                <a href={whatsappUrl({ name: product.name, sku: product.sku, quoteOnly: product.quoteOnly })} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  {product.quoteOnly ? "Cotizar por WhatsApp" : "Pedir por WhatsApp"}
                </a>
              </Button>
            </div>

            {/* Technical Specs & Details Tabs-like structure, simplified for editorial look */}
            <div className="space-y-8 border-t border-border pt-8 mt-auto">
              
              {product.descripcion && (
                <div>
                  <h3 className="font-display text-lg mb-4 uppercase border-l-4 border-primary pl-3">Descripción</h3>
                  <div className="text-muted-foreground text-sm leading-relaxed prose prose-sm max-w-none">
                    {product.descripcion}
                  </div>
                </div>
              )}

              {product.specs && product.specs.length > 0 && (
                <div>
                  <h3 className="font-display text-lg mb-4 uppercase border-l-4 border-primary pl-3">Especificaciones</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                    {product.specs.map((spec, i) => (
                      <div key={i} className="flex justify-between border-b border-border py-2">
                        <span className="text-muted-foreground text-sm">{spec.label}</span>
                        <span className="font-mono text-sm font-bold text-foreground text-right">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibilidad — tabla estructurada (Marca/Modelo/Años/Motor)
                  cuando el enriquecimiento la provee; si no, lista plana. */}
              {product.applications && product.applications.length > 0 ? (
                <div>
                  <h3 className="font-display text-lg mb-4 uppercase border-l-4 border-primary pl-3">Compatibilidad</h3>
                  <div className="border border-border max-h-72 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="px-3 py-2 font-bold">Marca</th>
                          <th className="px-3 py-2 font-bold">Modelo</th>
                          <th className="px-3 py-2 font-bold">Años</th>
                          <th className="px-3 py-2 font-bold">Motor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.applications.map((a, i) => (
                          <tr key={i} className="border-b border-border last:border-0 odd:bg-card/50">
                            <td className="px-3 py-2 font-bold text-foreground">{a.make}</td>
                            <td className="px-3 py-2 text-foreground">{a.model}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{formatYears(a.yearFrom, a.yearTo)}</td>
                            <td className="px-3 py-2 text-muted-foreground">{a.motor ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : product.vehicles && product.vehicles.length > 0 ? (
                <div>
                  <h3 className="font-display text-lg mb-4 uppercase border-l-4 border-primary pl-3">Vehículos Compatibles</h3>
                  <div className="bg-card border border-border p-4 max-h-48 overflow-y-auto custom-scrollbar">
                    <ul className="space-y-2">
                      {product.vehicles.map((v, i) => (
                        <li key={i} className="text-sm font-mono text-muted-foreground before:content-['>'] before:mr-2 before:text-primary">
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {/* Códigos de referencia / OEM — tabla estructurada (Código/Marca)
                  cuando el enriquecimiento la provee; si no, chips planos. */}
              {product.oemCodes && product.oemCodes.length > 0 ? (
                <div>
                  <h3 className="font-display text-lg mb-4 uppercase border-l-4 border-primary pl-3">Códigos de Referencia</h3>
                  <div className="border border-border max-h-72 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                          <th className="px-3 py-2 font-bold">Código</th>
                          <th className="px-3 py-2 font-bold">Marca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.oemCodes.map((o, i) => (
                          <tr key={i} className="border-b border-border last:border-0 odd:bg-card/50">
                            <td className="px-3 py-2 font-mono text-foreground">{o.code}</td>
                            <td className="px-3 py-2 text-muted-foreground">{o.brand ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (product.oem?.length || product.equivalents?.length) ? (
                <div>
                  <h3 className="font-display text-lg mb-4 uppercase border-l-4 border-primary pl-3">Referencias Cruzadas</h3>
                  <div className="flex flex-wrap gap-2">
                    {product.oem?.map((oem, i) => (
                      <span key={`oem-${i}`} className="inline-flex border border-border bg-card px-2 py-1 text-xs font-mono text-muted-foreground">
                        OEM: {oem}
                      </span>
                    ))}
                    {product.equivalents?.map((eq, i) => (
                      <span key={`eq-${i}`} className="inline-flex border border-border bg-card px-2 py-1 text-xs font-mono text-muted-foreground">
                        REF: {eq}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
