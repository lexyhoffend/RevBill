"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { useAuth } from "./RequireAuth";

export default function AccountNav() {
  const state = useAuth();
  const router = useRouter();

  if (state.status !== "authed") return null;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/account" className="text-slate-400 hover:text-sky-700 dark:hover:text-sky-400 hover:underline">
        {state.user.name || state.user.email}
      </Link>
      <button onClick={handleLogout} className="text-slate-500 hover:text-slate-800 hover:underline">
        Log out
      </button>
    </div>
  );
}
