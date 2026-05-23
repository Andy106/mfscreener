"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    if (!sessionStorage.getItem("isLoggedIn")) {
      router.replace("/login");
    }
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("isLoggedIn");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MFSelect</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Logout
        </button>
      </header>
      <main className="flex items-center justify-center h-[calc(100vh-65px)]">
        <p className="text-gray-400 text-sm">
          Dashboard — coming in Phase 2
        </p>
      </main>
    </div>
  );
}
