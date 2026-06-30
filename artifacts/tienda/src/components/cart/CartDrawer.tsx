import { useEffect, useState } from "react";
import { X, ShoppingCart, Minus, Plus, Trash2, Loader2, MessageCircle } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { createShopifyCartCheckout } from "@/lib/shopify-cart";
import { Button } from "@/components/ui/button";
import { STORE } from "@/lib/store";
import { ProductPlaceholder } from "@/components/product/ProductPlaceholder";

const priceFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

type CheckoutState = "idle" | "loading" | "fallback";

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, clearCart, total, itemCount } = useCart();
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setCheckoutState("idle");
  }, [isOpen]);

  async function handleCheckout() {
    if (items.length === 0 || checkoutState === "loading") return;
    setCheckoutState("loading");
    try {
      const result = await createShopifyCartCheckout(
        items.map((i) => ({ sku: i.sku, quantity: i.qty })),
      );
      if (result.available) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        setCheckoutState("idle");
      } else {
        setCheckoutState("fallback");
      }
    } catch {
      setCheckoutState("fallback");
    }
  }

  const whatsappMessage = items
    .map((i) => `• ${i.name} (SKU ${i.sku}) x${i.qty}`)
    .join("\n");
  const whatsappHref = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(
    `Hola, me gustaría pedir los siguientes productos de Carper Autopartes:\n\n${whatsappMessage}\n\nTotal estimado: ${priceFormatter.format(total)}`,
  )}`;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-[420px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-foreground" />
            <h2 className="font-display text-xl tracking-tighter uppercase">Carrito</h2>
            {itemCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-mono font-bold px-2 py-0.5 rounded-none">
                {itemCount}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-muted transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground px-8 text-center">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p className="font-mono text-sm uppercase tracking-wider">Su carrito está vacío</p>
              <Button
                variant="outline"
                className="rounded-none font-bold uppercase tracking-wider text-xs"
                onClick={closeCart}
              >
                Seguir comprando
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.sku} className="flex gap-4 p-5">
                  {/* Image */}
                  <div className="w-20 h-20 border border-border bg-card flex items-center justify-center shrink-0 p-2">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ProductPlaceholder name={item.name} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      {item.sku}
                    </p>
                    <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                      {item.name}
                    </p>
                    <p className="text-sm font-mono font-bold text-foreground mt-auto">
                      {priceFormatter.format(item.price * item.qty)}
                    </p>
                  </div>

                  {/* Qty + Remove */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={() => removeItem(item.sku)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center border border-border">
                      <button
                        onClick={() => updateQty(item.sku, item.qty - 1)}
                        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Reducir cantidad"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 h-8 flex items-center justify-center text-sm font-mono font-bold select-none">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.sku, item.qty + 1)}
                        className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-6 py-5 space-y-4 bg-card">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                Subtotal
              </span>
              <span className="text-xl font-mono font-bold text-foreground">
                {priceFormatter.format(total)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Envío calculado al finalizar la compra.
            </p>

            {checkoutState === "fallback" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Algunas piezas aún no están en la tienda en línea. Puede pedirlas por WhatsApp.
                </p>
                <Button
                  className="w-full rounded-none font-bold uppercase tracking-widest gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white"
                  asChild
                >
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" />
                    Pedir todo por WhatsApp
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-none font-bold uppercase tracking-widest text-xs"
                  onClick={() => setCheckoutState("idle")}
                >
                  Reintentar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full rounded-none font-bold uppercase tracking-widest gap-2"
                  onClick={handleCheckout}
                  disabled={checkoutState === "loading"}
                >
                  {checkoutState === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  {checkoutState === "loading" ? "Un momento…" : "Pagar en línea"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-none font-bold uppercase tracking-widest text-xs gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  asChild
                >
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Pedir por WhatsApp
                  </a>
                </Button>
                <button
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors font-mono uppercase tracking-wider text-center"
                  onClick={() => { clearCart(); closeCart(); }}
                >
                  Vaciar carrito
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
