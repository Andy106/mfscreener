"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Scheme {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem("isLoggedIn")) {
      router.replace("/login");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/schemes`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Scheme[]) => setSchemes(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  function handleLogout() {
    sessionStorage.removeItem("isLoggedIn");
    router.replace("/login");
  }

  const filtered = schemes.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.scheme_name.toLowerCase().includes(q) ||
      s.fund_house.toLowerCase().includes(q)
    );
  });

  const categories = Array.from(new Set(schemes.map((s) => s.scheme_category))).sort();

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

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Mutual Fund Schemes</h2>
          {!loading && !error && (
            <p className="mt-1 text-sm text-gray-500">
              {schemes.length} schemes across {categories.length} categories
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            Loading schemes...
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to load schemes: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by scheme name or fund house..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Scheme Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fund House</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-28">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                        No schemes match your search.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr
                        key={s.scheme_code}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-900">{s.scheme_name}</td>
                        <td className="px-4 py-3 text-gray-600">{s.fund_house}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5">
                            {s.scheme_category.replace("Equity Scheme - ", "")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{s.scheme_type}</td>
                        <td className="px-4 py-3 font-mono text-gray-400">{s.scheme_code}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
