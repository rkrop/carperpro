import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { CartProvider } from "@/lib/cart-context";
import { CartDrawer } from "@/components/cart/CartDrawer";

import Home from "@/pages/home";
import Catalogo from "@/pages/catalogo";
import Producto from "@/pages/producto";
import Contacto from "@/pages/contacto";
import Politicas from "@/pages/politicas";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalogo" component={Catalogo} />
      <Route path="/producto/:id" component={Producto} />
      <Route path="/contacto" component={Contacto} />
      <Route path="/politicas" component={Politicas} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppLayout>
              <Router />
            </AppLayout>
            <CartDrawer />
          </WouterRouter>
          <Toaster />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
