import { STORE, APP_URL } from "@/lib/store";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Instagram, MapPin, Phone, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-foreground text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <div className="font-display text-2xl tracking-tighter">Carper.</div>
            <p className="text-gray-400 max-w-sm">
              {STORE.tagline}. Refacciones de alto rendimiento para mecánicos y entusiastas.
            </p>
            <div className="flex items-center space-x-4">
              <a 
                href={STORE.instagramUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h3 className="font-display text-lg">Contacto</h3>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 shrink-0 text-white" />
                <a href={STORE.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  {STORE.address}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 shrink-0 text-white" />
                <a href={`tel:${STORE.phone}`} className="hover:text-white transition-colors">
                  {STORE.phoneDisplay}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 shrink-0 text-white" />
                <div className="space-y-1">
                  {STORE.hoursLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div className="space-y-6">
            <h3 className="font-display text-lg">Navegación</h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>
                <Link href="/" className="hover:text-white transition-colors uppercase tracking-wider text-xs font-bold">Inicio</Link>
              </li>
              <li>
                <Link href="/catalogo" className="hover:text-white transition-colors uppercase tracking-wider text-xs font-bold">Catálogo</Link>
              </li>
              <li>
                <Link href="/contacto" className="hover:text-white transition-colors uppercase tracking-wider text-xs font-bold">Sucursal</Link>
              </li>
            </ul>
          </div>

          {/* App Download */}
          <div className="space-y-6">
            <h3 className="font-display text-lg">Lleva Carper Contigo</h3>
            <div className="p-4 bg-white/5 border border-white/10 flex items-center gap-4">
              <div className="bg-white p-2 shrink-0">
                <QRCodeSVG value={APP_URL} size={64} level="M" />
              </div>
              <div>
                <p className="text-sm text-gray-300 mb-2">Escanea para descargar nuestra app móvil</p>
                <a 
                  href={APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-bold text-xs uppercase tracking-wider hover:underline"
                >
                  Descargar App
                </a>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500 font-mono">
          <div>© {new Date().getFullYear()} {STORE.name}. Todos los derechos reservados.</div>
          <div>RFC: {STORE.rfc}</div>
        </div>
      </div>
    </footer>
  );
}
