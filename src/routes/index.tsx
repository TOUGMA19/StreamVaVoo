import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { useHydrated } from "@/hooks/useHydrated";

export const Route = createFileRoute("/")({
  component: Index,
});

const M3UApp = lazy(() => import("@/components/M3UApp"));

function Index() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0704] text-white">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          <p className="text-stone-400 text-sm">Chargement de StreamFlow…</p>
        </div>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <M3UApp />
    </Suspense>
  );
}
