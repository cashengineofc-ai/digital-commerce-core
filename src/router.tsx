import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Carrega a rota quando o usuário aponta para ela no menu. Assim, o clique
    // troca a tela usando o módulo já em cache, em vez de iniciar o download.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 5 * 60 * 1000,
  });

  return router;
};
