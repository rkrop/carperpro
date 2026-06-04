import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Search, Loader2 } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";

const priceFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

interface SearchBarProps {
  /** Classes for the wrapping <form> (e.g. width/visibility utilities). */
  className?: string;
  /** Extra classes for the <input> (e.g. height). */
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Called after navigating (used to close the mobile menu). */
  onNavigate?: () => void;
}

export function SearchBar({
  className = "",
  inputClassName = "",
  placeholder = "Buscar por número de parte, SKU, marca...",
  autoFocus,
  onNavigate,
}: SearchBarProps) {
  const [, setLocation] = useLocation();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);

  // Debounce so we query the catalog as the user pauses, not on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 180);
    return () => clearTimeout(t);
  }, [value]);

  // Literal (no AI assist) lookup keeps predictions fast; the full catalog page
  // still applies natural-language assist when the user submits.
  const enabled = open && debounced.length >= 2;
  const params = { q: debounced, limit: 6 };
  const { data, isFetching } = useListProducts(params, {
    query: {
      enabled,
      placeholderData: keepPreviousData,
      queryKey: getListProductsQueryKey(params),
    },
  });

  const results = useMemo(
    () => (enabled ? data?.items ?? [] : []),
    [enabled, data],
  );

  // Reset the keyboard highlight whenever the query changes.
  useEffect(() => {
    setActiveIndex(-1);
  }, [debounced]);

  // Close on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setValue("");
    onNavigate?.();
    setLocation(path);
  };

  const submitSearch = () => {
    const q = value.trim();
    if (q) go(`/catalogo?q=${encodeURIComponent(q)}`);
  };

  const showDropdown = open && debounced.length >= 2;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        go(`/producto/${results[activeIndex].id}`);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <form
      ref={containerRef}
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch();
      }}
      className={`relative ${className}`}
      role="search"
    >
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`w-full pl-9 pr-9 bg-card border-border focus-visible:ring-primary font-mono text-sm ${inputClassName}`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
        />
        {isFetching && enabled && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border shadow-lg z-50 max-h-[70vh] overflow-y-auto">
          {results.length > 0 ? (
            <>
              <ul role="listbox">
                {results.map((p, i) => (
                  <li key={p.id} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(`/producto/${p.id}`)}
                      className={`flex items-center gap-3 w-full text-left px-3 py-2.5 border-b border-border last:border-b-0 transition-colors ${
                        i === activeIndex ? "bg-accent" : "hover:bg-card"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-foreground line-clamp-1">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider truncate">
                          {p.sku}
                          {p.brand ? ` · ${p.brand}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-mono font-bold text-foreground">
                        {priceFormatter.format(p.price)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={submitSearch}
                className="flex w-full items-center justify-between px-3 py-2.5 bg-card hover:bg-accent text-xs font-mono font-bold uppercase tracking-widest text-primary transition-colors"
              >
                Ver todos los resultados para "{debounced}"
              </button>
            </>
          ) : isFetching ? (
            <div className="px-3 py-4 text-sm font-mono text-muted-foreground">
              Buscando…
            </div>
          ) : (
            <div className="px-3 py-4 text-sm font-mono text-muted-foreground">
              Sin coincidencias. Presiona Enter para buscar en el catálogo.
            </div>
          )}
        </div>
      )}
    </form>
  );
}
