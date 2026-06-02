import { ReactNode } from "react";
function Link({ href, children, ...props }: { href?: string; children?: ReactNode; [key: string]: unknown }) {
  return <a href={href} {...props}>{children}</a>;
}
import { Home, Grid, Search, Tag, User, Mic, ScanLine, MapPin } from "lucide-react";

interface AppShellProps {
  children: ReactNode;
  activeTab: "inicio" | "categorias" | "buscar" | "ofertas" | "cuenta";
  showSearch?: boolean;
  searchQuery?: string;
}

export function AppShell({ children, activeTab, showSearch = true, searchQuery = "" }: AppShellProps) {
  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Header */}
      <div className="bg-white border-b border-[hsl(var(--c-border))] px-4 pt-12 pb-3 z-10 flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight text-[hsl(var(--c-accent))]">Carper</div>
          <div className="flex items-center gap-1 text-xs text-[hsl(var(--c-text-muted))] bg-[hsl(var(--c-bg))] px-2 py-1.5 rounded-md">
            <MapPin size={14} className="text-[hsl(var(--c-accent))]" />
            <span className="font-medium">Sucursal Centro</span>
          </div>
        </div>
        
        {showSearch && (
          <div className="relative flex items-center">
            <div className="absolute left-3 text-[hsl(var(--c-text-muted))]">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Buscar refacción, marca, SKU..." 
              defaultValue={searchQuery}
              className="w-full bg-[hsl(var(--c-bg))] border border-[hsl(var(--c-border))] rounded-lg pl-10 pr-20 py-2.5 text-sm focus:outline-none focus:border-[hsl(var(--c-accent))] focus:ring-1 focus:ring-[hsl(var(--c-accent))]"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button className="p-1.5 text-[hsl(var(--c-text-muted))] hover:text-[hsl(var(--c-text))] rounded-md">
                <Mic size={18} />
              </button>
              <button className="p-1.5 bg-[hsl(var(--c-accent))] text-white rounded-md flex items-center justify-center">
                <ScanLine size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto carper-hide-scroll bg-[hsl(var(--c-bg))] relative">
        {children}
      </div>

      {/* Bottom Tab Bar */}
      <div className="bg-white border-t border-[hsl(var(--c-border))] px-6 py-2 pb-6 flex items-center justify-between shrink-0">
        <TabItem icon={<Home size={22} />} label="Inicio" active={activeTab === "inicio"} href="/__mockup/preview/carper-a/Inicio" />
        <TabItem icon={<Grid size={22} />} label="Categorías" active={activeTab === "categorias"} href="#" />
        <TabItem icon={<Search size={22} />} label="Buscar" active={activeTab === "buscar"} href="/__mockup/preview/carper-a/Resultados" />
        <TabItem icon={<Tag size={22} />} label="Ofertas" active={activeTab === "ofertas"} href="#" />
        <TabItem icon={<User size={22} />} label="Cuenta" active={activeTab === "cuenta"} href="#" />
      </div>
    </div>
  );
}

function TabItem({ icon, label, active, href }: { icon: ReactNode; label: string; active: boolean; href: string }) {
  const content = (
    <div className={`flex flex-col items-center gap-1 ${active ? 'text-[hsl(var(--c-accent))]' : 'text-[hsl(var(--c-text-muted))]'}`}>
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
  
  if (href === "#") return <div className="cursor-default opacity-60">{content}</div>;
  
  return (
    <Link href={href} className="cursor-pointer">
      {content}
    </Link>
  );
}
