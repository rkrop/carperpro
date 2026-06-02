export function ProductPlaceholder({ name = "Producto" }: { name?: string }) {
  return (
    <div className="w-full h-full bg-[#fafafa] border border-border flex items-center justify-center relative overflow-hidden group">
      {/* Industrial grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-muted-foreground/30" />
      <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-muted-foreground/30" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-muted-foreground/30" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-muted-foreground/30" />
      
      {/* Center Wordmark */}
      <div className="relative z-10 flex flex-col items-center opacity-20 group-hover:opacity-30 transition-opacity duration-500">
        <span className="font-display text-4xl tracking-tighter text-foreground mb-2">Carper.</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-foreground max-w-[80%] text-center truncate">
          {name}
        </span>
      </div>
    </div>
  );
}
