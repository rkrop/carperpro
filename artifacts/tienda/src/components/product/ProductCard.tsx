import { Link } from "wouter";
import type { Product } from "@workspace/api-client-react";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { Button } from "@/components/ui/button";
import { MessageCircle, ShoppingCart } from "lucide-react";
import { whatsappUrl } from "@/lib/store";
import { useCart } from "@/lib/cart-context";

interface ProductCardProps {
  product: Product;
  featured?: boolean;
}

export function ProductCard({ product, featured = false }: ProductCardProps) {
  const quoteOnly = product.quoteOnly;
  const agotado = product.stock === 0;
  const enExistencia = typeof product.stock === "number" && product.stock > 0;
  const consultable = quoteOnly || !agotado;
  const { addItem } = useCart();

  const priceFormatter = new Intl.NumberFormat('es-MX', { 
    style: 'currency', 
    currency: 'MXN' 
  });

  return (
    <div className={`group flex flex-col bg-card border border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg ${featured ? 'md:flex-row' : ''}`}>
      {/* Image Area */}
      <div className={`relative p-6 bg-white border-b md:border-b-0 border-border ${featured ? 'md:w-1/2 md:border-r' : 'aspect-square'}`}>
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <ProductPlaceholder name={product.name} />
        )}
        
        {/* Availability Badge */}
        <div className="absolute top-4 right-4">
          {quoteOnly ? (
            <span className="bg-foreground text-white text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1">
              Consulta
            </span>
          ) : enExistencia ? (
            <span className="bg-success text-success-foreground text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1">
              {product.stock} disp.
            </span>
          ) : agotado ? (
            <span className="bg-muted text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 border border-border">
              Agotado
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-1 border border-border">
              Consultar
            </span>
          )}
        </div>
        
        {/* Brand Badge */}
        {product.brand && (
          <div className="absolute bottom-4 left-4 bg-foreground/90 backdrop-blur text-white text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1">
            {product.brand}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className={`flex flex-col p-6 min-w-0 ${featured ? 'md:w-1/2 justify-center' : 'flex-1'}`}>
        <div className="mb-2 text-xs font-mono text-muted-foreground uppercase tracking-widest truncate">
          {product.sku}
        </div>
        
        <h3 className={`font-bold text-foreground leading-tight mb-4 break-words ${featured ? 'text-2xl md:text-3xl font-display' : 'text-lg'}`}>
          <Link href={`/producto/${product.id}`} className="hover:text-primary transition-colors line-clamp-2">
            {product.name}
          </Link>
        </h3>
        
        <div className="mt-auto pt-4 border-t border-border flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {quoteOnly ? (
              <div className="text-sm font-mono font-bold uppercase tracking-wider text-foreground">
                Precio a consultar
              </div>
            ) : (
              <>
                {product.originalPrice && product.originalPrice > product.price && (
                  <div className="text-xs font-mono text-muted-foreground line-through">
                    {priceFormatter.format(product.originalPrice)}
                  </div>
                )}
                <div className="text-xl font-mono font-bold text-foreground">
                  {priceFormatter.format(product.price)}
                </div>
              </>
            )}
          </div>
          
          <div className="flex gap-2 shrink-0">
            {consultable && (
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-none border-border hover:border-green-500 hover:text-green-600 hover:bg-green-50 shrink-0"
                asChild
                title={quoteOnly ? "Cotizar por WhatsApp" : "Pedir por WhatsApp"}
              >
                <a href={whatsappUrl({ name: product.name, sku: product.sku, quoteOnly })} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4" />
                </a>
              </Button>
            )}
            {!quoteOnly && !agotado && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-none border-border hover:border-primary hover:text-primary shrink-0"
                title="Agregar al carrito"
                onClick={() =>
                  addItem({
                    sku: product.sku,
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image ?? null,
                  })
                }
              >
                <ShoppingCart className="w-4 h-4" />
              </Button>
            )}
            <Button className="rounded-none font-bold uppercase tracking-wider text-xs px-4 shrink-0" asChild>
              <Link href={`/producto/${product.id}`}>
                Ver
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
