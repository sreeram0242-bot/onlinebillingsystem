import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const rawBase = import.meta.env.BASE_URL || '/';
  const routerBase = rawBase === '/' ? '/' : (rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    basepath: routerBase,
  });

  return router;
};
