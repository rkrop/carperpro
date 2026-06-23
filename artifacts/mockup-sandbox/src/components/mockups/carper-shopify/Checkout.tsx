import React, { useState } from "react";
import { Lock, ShieldCheck, ChevronRight, CreditCard, HelpCircle, CheckCircle2 } from "lucide-react";
import { CarperWordmark, PayBadges, Money } from "./_shared/Chrome";
import "./_shared/theme.css";

export default function Checkout() {
  const [deliveryMethod, setDeliveryMethod] = useState("delivery");
  const [paymentMethod, setPaymentMethod] = useState("card");

  return (
    <div className="carper-shop min-h-screen flex flex-col bg-[hsl(var(--c-surface))] text-[hsl(var(--c-text))]">
      {/* Slim Checkout Header */}
      <header className="border-b border-[hsl(var(--c-border))] py-4 px-6 bg-[hsl(var(--c-surface))]">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <CarperWordmark />
          <div className="flex items-center gap-2 text-sm text-[hsl(var(--c-text-muted))]">
            <Lock className="w-4 h-4" />
            <span>Pago seguro</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1100px] w-full mx-auto px-4 md:px-6 py-8 flex flex-col lg:flex-row gap-10">
        
        {/* Left Column: Form (~60%) */}
        <div className="flex-1 space-y-10">
          
          {/* Express Checkout (Shopify style) */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px bg-[hsl(var(--c-border))] flex-1"></div>
              <span className="text-sm text-[hsl(var(--c-text-muted))] font-medium">Pago exprés</span>
              <div className="h-px bg-[hsl(var(--c-border))] flex-1"></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="w-full h-11 bg-[#5A31F4] rounded-md text-white font-bold flex items-center justify-center gap-2 hover:bg-[#4A21E4] transition-colors">
                <span className="italic tracking-wider">Shop</span>Pay
              </button>
              <button className="w-full h-11 bg-[#F5C22B] rounded-md text-[#2C2E2F] font-bold flex items-center justify-center gap-2 hover:bg-[#E4B11A] transition-colors">
                PayPal
              </button>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <div className="h-px bg-[hsl(var(--c-border))] flex-1"></div>
              <span className="text-sm text-[hsl(var(--c-text-muted))] font-medium">O continuar abajo</span>
              <div className="h-px bg-[hsl(var(--c-border))] flex-1"></div>
            </div>
          </div>

          {/* Contacto */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Contacto</h2>
              <a href="#" className="text-sm text-[hsl(var(--c-accent))] hover:underline">Iniciar sesión</a>
            </div>
            <div>
              <input 
                type="email" 
                defaultValue="cliente@correo.com"
                className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:border-transparent transition-shadow"
                placeholder="Correo electrónico o número de celular"
              />
              <div className="mt-2 flex items-center gap-2">
                <input type="checkbox" id="news" className="rounded border-gray-300 text-[hsl(var(--c-accent))] focus:ring-[hsl(var(--c-accent))]" defaultChecked />
                <label htmlFor="news" className="text-sm text-[hsl(var(--c-text-muted))]">Enviarme novedades y ofertas</label>
              </div>
            </div>
          </section>

          {/* Entrega */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Entrega</h2>
            <div className="border border-[hsl(var(--c-border))] rounded-md overflow-hidden bg-white mb-6">
              <label className="flex items-center p-4 border-b border-[hsl(var(--c-border))] cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  name="delivery" 
                  value="delivery" 
                  checked={deliveryMethod === "delivery"}
                  onChange={() => setDeliveryMethod("delivery")}
                  className="w-4 h-4 text-[hsl(var(--c-accent))] focus:ring-[hsl(var(--c-accent))]"
                />
                <span className="ml-3 font-medium">Envío a domicilio</span>
                <Lock className="w-4 h-4 ml-auto text-[hsl(var(--c-text-muted))]" />
              </label>
              <label className="flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-colors">
                <input 
                  type="radio" 
                  name="delivery" 
                  value="pickup"
                  checked={deliveryMethod === "pickup"}
                  onChange={() => setDeliveryMethod("pickup")}
                  className="w-4 h-4 text-[hsl(var(--c-accent))] focus:ring-[hsl(var(--c-accent))]"
                />
                <span className="ml-3 font-medium">Recoger en sucursal</span>
                <span className="ml-auto text-sm font-medium">Gratis</span>
              </label>
            </div>

            {deliveryMethod === "delivery" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Nombre" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                  <input type="text" placeholder="Apellidos" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                </div>
                <input type="text" placeholder="Calle y número" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                <input type="text" placeholder="Colonia, edificio, departamento, etc. (opcional)" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <input type="text" placeholder="Código postal" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                    <HelpCircle className="w-4 h-4 text-gray-400 absolute right-3 top-3.5" />
                  </div>
                  <input type="text" placeholder="Ciudad" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                  <select className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none bg-white">
                    <option>Jalisco</option>
                    <option>Ciudad de México</option>
                    <option>Nuevo León</option>
                  </select>
                </div>
                <input type="tel" placeholder="Teléfono" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
              </div>
            )}
            
            {deliveryMethod === "pickup" && (
              <div className="p-4 border border-[hsl(var(--c-border))] rounded-md bg-gray-50 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[hsl(var(--c-accent))] mt-0.5" />
                <div>
                  <div className="font-medium">Sucursal Guadalajara Centro</div>
                  <div className="text-sm text-[hsl(var(--c-text-muted))] mt-1">Av. Niños Héroes 1234, Centro, 44100 Guadalajara, Jal.</div>
                  <div className="text-sm text-[hsl(var(--c-success))] font-medium mt-2">Disponible para recoger hoy mismo</div>
                </div>
              </div>
            )}
          </section>

          {/* Pago */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Pago</h2>
              <p className="text-sm text-[hsl(var(--c-text-muted))] mt-1">Todas las transacciones son seguras y están encriptadas.</p>
            </div>
            
            <div className="border border-[hsl(var(--c-border))] rounded-md overflow-hidden bg-white">
              
              {/* Tarjeta */}
              <div className={`border-b border-[hsl(var(--c-border))] transition-colors ${paymentMethod === 'card' ? 'bg-[hsl(var(--c-bg))]' : 'hover:bg-gray-50'}`}>
                <label className="flex items-center justify-between p-4 cursor-pointer">
                  <div className="flex items-center">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="card" 
                      checked={paymentMethod === "card"}
                      onChange={() => setPaymentMethod("card")}
                      className="w-4 h-4 text-[hsl(var(--c-accent))] focus:ring-[hsl(var(--c-accent))]"
                    />
                    <span className="ml-3 font-medium">Tarjeta de crédito/débito</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-80">
                    <div className="w-8 h-5 bg-blue-800 rounded flex items-center justify-center text-[8px] text-white font-bold italic">VISA</div>
                    <div className="w-8 h-5 bg-red-600 rounded flex items-center justify-center text-[8px] text-white font-bold">MC</div>
                    <div className="w-8 h-5 bg-sky-400 rounded flex items-center justify-center text-[8px] text-white font-bold">AMEX</div>
                  </div>
                </label>
                
                {paymentMethod === "card" && (
                  <div className="p-4 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="relative">
                      <input type="text" placeholder="Número de tarjeta" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                      <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-3.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" placeholder="Fecha de vencimiento (MM/AA)" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                      <div className="relative">
                        <input type="text" placeholder="Código de seguridad" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                        <HelpCircle className="w-4 h-4 text-gray-400 absolute right-3 top-3.5" />
                      </div>
                    </div>
                    <input type="text" placeholder="Nombre en la tarjeta" className="w-full px-3 py-3 border border-[hsl(var(--c-border))] rounded-md focus:ring-2 focus:ring-[hsl(var(--c-accent))] focus:outline-none" />
                    <div className="text-xs text-center text-[hsl(var(--c-text-muted))] pt-2 flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Procesado de forma segura por Mercado Pago
                    </div>
                  </div>
                )}
              </div>

              {/* OXXO */}
              <div className={`border-b border-[hsl(var(--c-border))] transition-colors ${paymentMethod === 'oxxo' ? 'bg-[hsl(var(--c-bg))]' : 'hover:bg-gray-50'}`}>
                <label className="flex items-center p-4 cursor-pointer">
                  <input 
                    type="radio" 
                    name="payment" 
                    value="oxxo" 
                    checked={paymentMethod === "oxxo"}
                    onChange={() => setPaymentMethod("oxxo")}
                    className="w-4 h-4 text-[hsl(var(--c-accent))] focus:ring-[hsl(var(--c-accent))]"
                  />
                  <span className="ml-3 font-medium">OXXO</span>
                </label>
                {paymentMethod === "oxxo" && (
                  <div className="px-4 pb-4 animate-in fade-in">
                    <div className="p-4 bg-white border border-[hsl(var(--c-border))] rounded text-sm text-[hsl(var(--c-text-muted))] text-center">
                      Recibirá un código para pagar en efectivo en cualquier tienda OXXO. Su pedido se procesará una vez confirmado el pago.
                    </div>
                  </div>
                )}
              </div>

              {/* SPEI */}
              <div className={`border-b border-[hsl(var(--c-border))] transition-colors ${paymentMethod === 'spei' ? 'bg-[hsl(var(--c-bg))]' : 'hover:bg-gray-50'}`}>
                <label className="flex items-center p-4 cursor-pointer">
                  <input 
                    type="radio" 
                    name="payment" 
                    value="spei" 
                    checked={paymentMethod === "spei"}
                    onChange={() => setPaymentMethod("spei")}
                    className="w-4 h-4 text-[hsl(var(--c-accent))] focus:ring-[hsl(var(--c-accent))]"
                  />
                  <span className="ml-3 font-medium">SPEI / Transferencia</span>
                </label>
                {paymentMethod === "spei" && (
                  <div className="px-4 pb-4 animate-in fade-in">
                    <div className="p-4 bg-white border border-[hsl(var(--c-border))] rounded text-sm text-[hsl(var(--c-text-muted))] text-center">
                      Obtendrá los datos de transferencia vía Mercado Pago al finalizar.
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp / Efectivo */}
              <div className={`transition-colors ${paymentMethod === 'whatsapp' ? 'bg-[#f0fdf4]' : 'hover:bg-gray-50'}`}>
                <label className="flex items-center p-4 cursor-pointer">
                  <input 
                    type="radio" 
                    name="payment" 
                    value="whatsapp" 
                    checked={paymentMethod === "whatsapp"}
                    onChange={() => setPaymentMethod("whatsapp")}
                    className="w-4 h-4 text-[hsl(var(--c-wa))] focus:ring-[hsl(var(--c-wa))]"
                  />
                  <div className="ml-3 flex flex-col">
                    <span className="font-medium text-[hsl(var(--c-wa))]">Pagar por WhatsApp o efectivo en sucursal</span>
                  </div>
                </label>
                {paymentMethod === "whatsapp" && (
                  <div className="px-4 pb-4 animate-in fade-in">
                    <div className="p-4 bg-white border border-[#bbf7d0] rounded text-sm text-[hsl(var(--c-text-muted))] flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#dcfce7] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-[hsl(var(--c-wa))]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                      </div>
                      <div>
                        Seleccione esta opción para enviar su pedido por WhatsApp a nuestro equipo de ventas. Coordinaremos la entrega y el pago (transferencia o efectivo en sucursal) directamente con usted de forma rápida y personal.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <button className="w-full h-14 text-lg font-bold bg-[hsl(var(--c-accent))] hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm">
            Pagar $4,272.33
          </button>
          
          <div className="flex items-center justify-center border-t border-[hsl(var(--c-border))] pt-6 text-sm text-[hsl(var(--c-text-muted))]">
            Todos los derechos reservados Carper Autopartes
          </div>

        </div>

        {/* Right Column: Order Summary (~40%) */}
        <div className="lg:w-[420px] w-full mt-10 lg:mt-0">
          <div className="bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] rounded-lg p-6 sticky top-6">
            
            {/* Items */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white border border-[hsl(var(--c-border))] rounded flex items-center justify-center p-1 relative">
                    <img src="/__mockup/images/carper-starter.png" alt="Marcha" className="object-contain w-full h-full" />
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white text-xs rounded-full flex items-center justify-center font-medium">1</div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h4 className="font-medium text-sm line-clamp-2">Marcha Bosch Tsuru 1.6</h4>
                  <p className="text-xs text-[hsl(var(--c-text-muted))] mt-0.5 carper-mono">SKU 2740</p>
                </div>
                <div className="font-medium text-sm flex items-center">
                  <Money amount={1792.33} />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="relative">
                  <div className="w-16 h-16 bg-white border border-[hsl(var(--c-border))] rounded flex items-center justify-center p-1 relative">
                    <img src="/__mockup/images/shop-battery.png" alt="Batería" className="object-contain w-full h-full" />
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-gray-500 text-white text-xs rounded-full flex items-center justify-center font-medium">1</div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h4 className="font-medium text-sm line-clamp-2">Batería LTH L-42-500</h4>
                  <p className="text-xs text-[hsl(var(--c-text-muted))] mt-0.5 carper-mono">SKU 8810</p>
                </div>
                <div className="font-medium text-sm flex items-center">
                  <Money amount={2150.00} />
                </div>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--c-border))] py-4 flex gap-2">
              <input type="text" placeholder="Código de descuento" className="flex-1 px-3 py-2 border border-[hsl(var(--c-border))] rounded bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--c-accent))]" />
              <button className="px-4 py-2 bg-gray-200 text-gray-500 font-medium rounded hover:bg-gray-300 transition-colors" disabled>
                Usar
              </button>
            </div>

            <div className="border-t border-[hsl(var(--c-border))] py-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(var(--c-text-muted))]">Subtotal</span>
                <span className="font-medium"><Money amount={3942.33} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(var(--c-text-muted))]">Envío</span>
                {deliveryMethod === 'pickup' ? (
                  <span className="font-medium text-[hsl(var(--c-success))]">Gratis</span>
                ) : (
                  <span className="font-medium"><Money amount={141.00} /></span>
                )}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[hsl(var(--c-text-muted))]">Impuestos (IVA incluido)</span>
                <span className="text-[hsl(var(--c-text-muted))]"><Money amount={589.28} /></span>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--c-border))] pt-4 flex justify-between items-center">
              <span className="text-lg font-medium">Total</span>
              <span className="text-2xl font-bold flex items-center gap-1">
                <span className="text-sm text-[hsl(var(--c-text-muted))] font-normal mr-1">MXN</span>
                {deliveryMethod === 'pickup' ? <Money amount={3942.33} /> : <Money amount={4083.33} />}
              </span>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[hsl(var(--c-text-muted))] bg-white p-3 rounded border border-[hsl(var(--c-border))]">
              <ShieldCheck className="w-5 h-5 text-[hsl(var(--c-success))]" />
              <span>Compra protegida · Stock confirmado en tiempo real</span>
            </div>
            
            <div className="mt-4 flex justify-center opacity-60 grayscale">
              <PayBadges />
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
