import { Wrench, Battery, Zap, Lightbulb, Settings, Fan } from "lucide-react";

export function ProductImage({ 
  src, 
  alt, 
  category = "general",
  className = ""
}: { 
  src?: string; 
  alt: string; 
  category?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`bg-white rounded-lg border border-[hsl(var(--c-border))] overflow-hidden flex items-center justify-center p-2 ${className}`}>
        <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  // Placeholder logic
  const getIcon = () => {
    switch (category.toLowerCase()) {
      case "marchas": case "alternadores": return <Settings size={32} strokeWidth={1.5} />;
      case "baterías": case "sistema eléctrico": return <Battery size={32} strokeWidth={1.5} />;
      case "encendido": return <Zap size={32} strokeWidth={1.5} />;
      case "iluminación": return <Lightbulb size={32} strokeWidth={1.5} />;
      case "enfriamiento": return <Fan size={32} strokeWidth={1.5} />;
      default: return <Wrench size={32} strokeWidth={1.5} />;
    }
  };

  return (
    <div className={`bg-[hsl(var(--c-bg))] rounded-lg border border-[hsl(var(--c-border))] overflow-hidden flex items-center justify-center text-[hsl(var(--c-text-muted))] opacity-70 ${className}`}>
      {getIcon()}
    </div>
  );
}
