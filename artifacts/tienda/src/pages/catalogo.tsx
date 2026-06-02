import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { useListProducts, useListCategories, useListBrands, getListProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSeo, breadcrumbJsonLd } from "@/lib/seo";

export default function Catalogo() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") || "");
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  
  const [page, setPage] = useState(1);
  const limit = 24;
  const offset = (page - 1) * limit;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [q, categoryId, brand]);

  const productParams = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    brand: brand || undefined,
    limit,
    offset,
  };
  const { data: productsData, isLoading } = useListProducts(productParams, {
    query: {
      placeholderData: keepPreviousData,
      queryKey: getListProductsQueryKey(productParams),
    }
  });

  const { data: categories } = useListCategories();
  const { data: brands } = useListBrands();

  const totalPages = productsData ? Math.ceil(productsData.total / limit) : 0;

  const activeCategory = categories?.find((c) => c.id === categoryId);

  // Build a unique, descriptive title/description per filter state. Plain
  // category views stay indexable with a clean canonical; free-text searches
  // are marked noindex (thin/duplicate result pages).
  let seoTitle: string;
  let seoDescription: string;
  let canonicalPath = "/catalogo";
  if (q) {
    seoTitle = `Resultados para "${q}" | Carper Autopartes`;
    seoDescription = `Refacciones y autopartes que coinciden con "${q}" en el catálogo de Carper Autopartes, Ciudad Obregón. Consulta precio y disponibilidad.`;
  } else if (activeCategory) {
    seoTitle = `${activeCategory.name} | Refacciones | Carper Autopartes`;
    seoDescription = `Explora ${activeCategory.count} refacciones de la línea ${activeCategory.name} en Carper Autopartes, Ciudad Obregón. Precio y disponibilidad al instante.`;
    canonicalPath = `/catalogo?categoryId=${categoryId}`;
  } else if (brand) {
    seoTitle = `${brand} | Refacciones | Carper Autopartes`;
    seoDescription = `Refacciones y autopartes de la marca ${brand} disponibles en Carper Autopartes, Ciudad Obregón. Consulta precio y disponibilidad.`;
  } else {
    seoTitle = "Catálogo de Refacciones y Autopartes | Carper Autopartes";
    seoDescription =
      "Explora miles de refacciones y autopartes en el catálogo de Carper Autopartes, Ciudad Obregón. Busca por número de parte, línea o marca y pide por WhatsApp.";
  }

  useSeo({
    title: seoTitle,
    description: seoDescription,
    path: canonicalPath,
    noindex: !!q,
    jsonLd: breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      activeCategory
        ? { name: activeCategory.name, path: `/catalogo?categoryId=${categoryId}` }
        : { name: "Catálogo", path: "/catalogo" },
    ]),
  });

  const FilterContent = () => (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg tracking-tight mb-4 uppercase border-b pb-2">Búsqueda</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={q} 
            onChange={(e) => setQ(e.target.value)}
            placeholder="Número de parte, nombre..."
            className="pl-9 font-mono text-sm rounded-none border-border focus-visible:ring-primary h-10"
          />
          {q && (
            <button 
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg tracking-tight mb-4 uppercase border-b pb-2">Líneas</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <button
            onClick={() => setCategoryId("")}
            className={`block w-full text-left text-sm font-mono uppercase tracking-widest py-1 transition-colors ${!categoryId ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Todas las líneas
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className={`block w-full text-left text-sm font-mono uppercase tracking-widest py-1 transition-colors ${categoryId === cat.id ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg tracking-tight mb-4 uppercase border-b pb-2">Marcas</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <button
            onClick={() => setBrand("")}
            className={`block w-full text-left text-sm font-mono uppercase tracking-widest py-1 transition-colors ${!brand ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Todas las marcas
          </button>
          {brands?.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={`block w-full text-left text-sm font-mono uppercase tracking-widest py-1 transition-colors ${brand === b ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-background min-h-screen">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12">
          <h1 className="font-display text-4xl md:text-5xl tracking-tighter uppercase">Catálogo de Refacciones</h1>
          {productsData && (
            <p className="mt-2 text-muted-foreground font-mono text-sm tracking-widest uppercase">
              Mostrando {productsData.items.length} de {productsData.total} resultados
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <FilterContent />
          </aside>

          {/* Mobile Filter Toggle */}
          <div className="lg:hidden mb-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full rounded-none font-bold uppercase tracking-widest border-border">
                  <Filter className="w-4 h-4 mr-2" /> Filtros
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] rounded-none p-6">
                <SheetHeader className="mb-8 text-left">
                  <SheetTitle className="font-display text-2xl uppercase tracking-tighter">Filtros</SheetTitle>
                </SheetHeader>
                <FilterContent />
              </SheetContent>
            </Sheet>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            {isLoading && !productsData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(12)].map((_, i) => (
                  <Skeleton key={i} className="h-96 w-full" />
                ))}
              </div>
            ) : productsData?.items.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-border bg-card">
                <div className="font-display text-2xl mb-2">No se encontraron productos</div>
                <p className="text-muted-foreground font-mono text-sm">Intenta ajustar los filtros de búsqueda.</p>
                <Button 
                  variant="outline" 
                  className="mt-6 rounded-none font-bold uppercase"
                  onClick={() => { setQ(""); setCategoryId(""); setBrand(""); }}
                >
                  Limpiar Filtros
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {productsData?.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-12 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-none border-border"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center px-4 font-mono text-sm text-muted-foreground">
                      Página {page} de {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-none border-border"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
