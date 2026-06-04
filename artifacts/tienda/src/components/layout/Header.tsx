import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./SearchBar";
import { APP_URL } from "@/lib/store";

export function Header() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { href: "/catalogo", label: "Catálogo" },
    { href: "/contacto", label: "Sucursal" },
  ];

  return (
    <>
      {/* Top Banner */}
      <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest py-2 px-4 text-center font-mono">
        <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center justify-center gap-2">
          Descarga la app de Carper <ArrowRight className="w-3 h-3" />
        </a>
      </div>

      <header 
        className={`sticky top-0 z-50 w-full transition-all duration-300 border-b ${
          isScrolled ? "bg-white/90 backdrop-blur-md border-border shadow-sm" : "bg-white border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4 md:gap-8">
            {/* Logo */}
            <Link href="/" className="font-display text-2xl tracking-tighter shrink-0 text-foreground">
              Carper.
            </Link>

            {/* Desktop Search */}
            <SearchBar
              className="hidden md:flex flex-1 max-w-xl"
              inputClassName="h-10"
            />

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 shrink-0">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-bold uppercase tracking-wider transition-colors hover:text-primary ${
                    location === link.href ? "text-primary" : "text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-foreground hover:bg-muted shrink-0"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-white absolute top-full left-0 w-full shadow-lg">
            <div className="p-4 space-y-4">
              <SearchBar
                inputClassName="h-12"
                placeholder="Buscar producto..."
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
              <nav className="flex flex-col gap-2">
                <Link
                  href="/"
                  className="p-3 text-sm font-bold uppercase tracking-wider border border-transparent hover:border-border hover:bg-card transition-all"
                >
                  Inicio
                </Link>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="p-3 text-sm font-bold uppercase tracking-wider border border-transparent hover:border-border hover:bg-card transition-all"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
