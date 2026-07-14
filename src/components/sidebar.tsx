"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ITENS = [
  { href: "/pessoas", label: "Pessoas" },
  { href: "/contratos", label: "Contratos" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-60 shrink-0 bg-ink text-white flex flex-col min-h-screen">
      <div className="px-6 py-7">
        <p className="text-sm font-extrabold tracking-wide">EASY COMPANY</p>
        <p className="text-xs text-white/50 mt-0.5">Sistema interno</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {ITENS.map((item) => {
          const ativo = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                ativo ? "bg-forest text-white" : "text-white/60 hover:bg-forest/50 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-6">
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold text-white/50 hover:bg-forest/50 hover:text-white transition-colors"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
