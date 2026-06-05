import { ShieldCheck, FileText, Truck, RotateCcw, CreditCard, Cookie, type LucideIcon } from "lucide-react";
import { POLICIES, POLICIES_UPDATED } from "@/lib/policies";
import { useSeo, organizationJsonLd, breadcrumbJsonLd } from "@/lib/seo";

/** Per-document icon (lucide names; the app copy maps the same ids to Feather). */
const ICONS: Record<string, LucideIcon> = {
  "aviso-privacidad": ShieldCheck,
  terminos: FileText,
  envios: Truck,
  devoluciones: RotateCcw,
  pagos: CreditCard,
  cookies: Cookie,
};

export default function Politicas() {
  useSeo({
    title: "Políticas y Privacidad | Carper Autopartes",
    description:
      "Aviso de privacidad, términos y condiciones, envíos, devoluciones, pagos y cookies de Carper Autopartes en Ciudad Obregón.",
    path: "/politicas",
    jsonLd: [
      organizationJsonLd(),
      breadcrumbJsonLd([
        { name: "Inicio", path: "/" },
        { name: "Políticas y Privacidad", path: "/politicas" },
      ]),
    ],
  });

  return (
    <div className="bg-background min-h-screen">
      {/* Header Banner */}
      <div className="bg-foreground text-white py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 relative z-10">
          <h1 className="font-display text-4xl md:text-6xl tracking-tighter uppercase mb-4">
            Políticas y Privacidad
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl">
            Conozca cómo protegemos sus datos y las condiciones de compra, envío, pagos y garantías de Carper Autopartes.
          </p>
          <p className="font-mono text-xs text-gray-500 mt-6 uppercase tracking-widest">
            Última actualización: {POLICIES_UPDATED}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Sticky table of contents */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <nav className="lg:sticky lg:top-24 space-y-1">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Índice
              </h2>
              {POLICIES.map((doc) => {
                const Icon = ICONS[doc.id] ?? FileText;
                return (
                  <a
                    key={doc.id}
                    href={`#${doc.id}`}
                    className="flex items-center gap-3 px-3 py-3 border border-transparent hover:border-border hover:bg-card transition-colors group"
                  >
                    <Icon className="w-4 h-4 shrink-0 text-primary" />
                    <span className="text-sm font-bold uppercase tracking-wide text-foreground group-hover:text-primary transition-colors">
                      {doc.title}
                    </span>
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-16">
            {POLICIES.map((doc) => {
              const Icon = ICONS[doc.id] ?? FileText;
              return (
                <section key={doc.id} id={doc.id} className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="shrink-0 w-10 h-10 bg-card border border-border flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="font-display text-2xl md:text-3xl tracking-tight uppercase">
                      {doc.title}
                    </h2>
                  </div>
                  <p className="text-muted-foreground text-sm mb-8 max-w-2xl">{doc.summary}</p>

                  <div className="space-y-8">
                    {doc.sections.map((s, i) => (
                      <div key={i}>
                        <h3 className="font-bold text-base text-foreground mb-3">{s.heading}</h3>
                        {s.paragraphs?.map((p, j) => (
                          <p key={`p${j}`} className="text-muted-foreground text-sm leading-relaxed mb-3">
                            {p}
                          </p>
                        ))}
                        {s.bullets && (
                          <ul className="space-y-2 mt-2">
                            {s.bullets.map((b, j) => (
                              <li key={`b${j}`} className="flex gap-3 text-muted-foreground text-sm leading-relaxed">
                                <span className="text-primary font-bold shrink-0">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
