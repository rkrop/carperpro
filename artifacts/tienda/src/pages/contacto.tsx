import { STORE, APP_URL, whatsappUrl } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { MapPin, Phone, Clock, Mail, MessageCircle, Instagram } from "lucide-react";

export default function Contacto() {
  return (
    <div className="bg-background min-h-screen">
      {/* Header Banner */}
      <div className="bg-foreground text-white py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
          <h1 className="font-display text-4xl md:text-6xl tracking-tighter uppercase mb-4">
            Nuestra Sucursal
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl">
            Visítanos en Ciudad Obregón o contáctanos por WhatsApp para asistencia técnica y pedidos.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Main Info Column */}
          <div className="lg:col-span-7 space-y-12">
            
            {/* Contact Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="shrink-0 w-12 h-12 bg-card border border-border flex items-center justify-center">
                    <MapPin className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase tracking-tight mb-2">Dirección</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{STORE.address}</p>
                    <a href={STORE.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 font-bold text-xs uppercase tracking-widest text-primary hover:underline">
                      Ver en Google Maps
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="shrink-0 w-12 h-12 bg-card border border-border flex items-center justify-center">
                    <Phone className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase tracking-tight mb-2">Teléfono</h3>
                    <a href={`tel:${STORE.phone}`} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
                      {STORE.phoneDisplay}
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="shrink-0 w-12 h-12 bg-card border border-border flex items-center justify-center">
                    <Mail className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase tracking-tight mb-2">Correo</h3>
                    <a href={`mailto:${STORE.email}`} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
                      {STORE.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="shrink-0 w-12 h-12 bg-card border border-border flex items-center justify-center">
                    <Clock className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase tracking-tight mb-2">Horarios</h3>
                    <ul className="space-y-1 text-muted-foreground text-sm font-mono">
                      {STORE.hoursLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="shrink-0 w-12 h-12 bg-card border border-border flex items-center justify-center">
                    <Instagram className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase tracking-tight mb-2">Instagram</h3>
                    <a href={STORE.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground text-sm hover:text-foreground transition-colors">
                      @{STORE.instagram}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <div className="bg-card border border-border p-8">
              <h3 className="font-display text-2xl uppercase tracking-tight mb-4">¿Dudas o pedidos?</h3>
              <p className="text-muted-foreground mb-6">
                Nuestros asesores están listos para ayudarte a encontrar la pieza correcta. Contáctanos por WhatsApp para respuesta inmediata.
              </p>
              <Button size="lg" className="rounded-none font-bold uppercase tracking-widest gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-transparent w-full sm:w-auto" asChild>
                <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5" />
                  Escríbenos por WhatsApp
                </a>
              </Button>
            </div>
            
            {/* Delivery Info */}
            <div className="border-t border-border pt-8">
               <h3 className="font-display text-lg uppercase tracking-tight mb-4 text-primary">Servicio a Domicilio</h3>
               <p className="text-muted-foreground text-sm mb-2">
                 Ofrecemos servicio a domicilio {STORE.delivery.gratis ? "gratuito" : ""} en {STORE.delivery.zona}.
               </p>
               <p className="font-mono text-xs font-bold uppercase tracking-widest text-foreground">
                 Tiempo estimado: {STORE.delivery.eta}
               </p>
            </div>
          </div>

          {/* App Sidebar */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 bg-primary text-white p-8">
              <h3 className="font-display text-2xl uppercase tracking-tight mb-4">Lleva el catálogo contigo</h3>
              <p className="text-primary-foreground/80 text-sm mb-8 leading-relaxed">
                Descarga la app de Carper para escanear números de parte, guardar información de tus vehículos y acceder a ofertas exclusivas.
              </p>
              
              <div className="bg-white p-6 shadow-2xl flex flex-col items-center">
                <QRCodeSVG value={APP_URL} size={160} level="M" />
                <div className="mt-6 text-center text-foreground w-full">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                    Escanea para descargar
                  </p>
                  <Button variant="outline" className="w-full rounded-none border-border hover:border-primary uppercase tracking-widest font-bold text-xs" asChild>
                    <a href={APP_URL} target="_blank" rel="noopener noreferrer">
                      Abrir enlace directo
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
