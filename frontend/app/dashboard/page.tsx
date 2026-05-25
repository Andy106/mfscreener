"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Scheme {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  scheme_category: string;
  scheme_type: string;
}

interface SchemeRow extends Scheme {
  min_return_1y: number | null; max_return_1y: number | null; avg_return_1y: number | null;
  min_return_3y: number | null; max_return_3y: number | null; avg_return_3y: number | null;
  min_return_5y: number | null; max_return_5y: number | null; avg_return_5y: number | null;
  min_sd_1y: number | null; max_sd_1y: number | null; avg_sd_1y: number | null;
  min_sd_3y: number | null; max_sd_3y: number | null; avg_sd_3y: number | null;
  min_sd_5y: number | null; max_sd_5y: number | null; avg_sd_5y: number | null;
}

const CATEGORIES = [
  "Equity Scheme - Flexi Cap Fund",
  "Equity Scheme - Multi Cap Fund",
];

function pct(v: number | null) {
  if (v == null) return <span className="text-gray-300">—</span>;
  const color = v >= 0 ? "text-green-700" : "text-red-600";
  return <span className={color}>{(v * 100).toFixed(1)}%</span>;
}

function sd(v: number | null) {
  if (v == null) return <span className="text-gray-300">—</span>;
  return <span className="text-gray-700">{(v * 100).toFixed(1)}%</span>;
}

export default function DashboardPage() {
  const router = useRouter();

  const [allSchemes, setAllSchemes] = useState<Scheme[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [schemeSearch, setSchemeSearch] = useState("");

  const [startDate, setStartDate] = useState("2015-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [rows, setRows] = useState<SchemeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasApplied, setHasApplied] = useState(false);

  const [watchlistCodes, setWatchlistCodes] = useState<Set<string>>(new Set());
  const [watchlistBusy, setWatchlistBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionStorage.getItem("isLoggedIn")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/watchlist`)
      .then((r) => r.json())
      .then((data: Scheme[]) => setWatchlistCodes(new Set(data.map((s) => s.scheme_code))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/schemes`)
      .then((r) => r.json())
      .then((data: Scheme[]) => {
        const filtered = data.filter((s) => s.scheme_category === category);
        setAllSchemes(filtered);
        setSelectedCodes(new Set(filtered.map((s) => s.scheme_code)));
        setSchemeSearch("");
        setRows([]);
        setHasApplied(false);
      });
  }, [category]);

  function handleLogout() {
    sessionStorage.removeItem("isLoggedIn");
    router.replace("/login");
  }

  function toggleAll(checked: boolean) {
    setSelectedCodes(checked ? new Set(allSchemes.map((s) => s.scheme_code)) : new Set());
  }

  function toggleOne(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function handleApply() {
    if (selectedCodes.size === 0) return;
    setLoading(true);
    setError("");
    setHasApplied(true);

    const params = new URLSearchParams({ category });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (selectedCodes.size < allSchemes.length) {
      params.set("scheme_codes", [...selectedCodes].join(","));
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/screener?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SchemeRow[]) => setRows(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function toggleWatchlist(code: string) {
    if (watchlistBusy.has(code)) return;
    setWatchlistBusy((prev) => new Set(prev).add(code));
    const inWatchlist = watchlistCodes.has(code);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/watchlist/${code}`, {
        method: inWatchlist ? "DELETE" : "POST",
      });
      if (res.ok) {
        setWatchlistCodes((prev) => {
          const next = new Set(prev);
          inWatchlist ? next.delete(code) : next.add(code);
          return next;
        });
      }
    } finally {
      setWatchlistBusy((prev) => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
    }
  }

  const visibleSchemes = schemeSearch.trim()
    ? allSchemes.filter((s) =>
        s.scheme_name.toLowerCase().includes(schemeSearch.toLowerCase()) ||
        s.fund_house.toLowerCase().includes(schemeSearch.toLowerCase())
      )
    : allSchemes;

  const allChecked = allSchemes.length > 0 && selectedCodes.size === allSchemes.length;
  const someChecked = selectedCodes.size > 0 && selectedCodes.size < allSchemes.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MFSelect</h1>
        <nav className="flex items-center gap-6">
          <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">Screener</span>
          <Link href="/watchlist" className="text-sm text-gray-500 hover:text-gray-900">Watchlist</Link>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Logout</button>
        </nav>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 flex gap-6">

        {/* Left panel — filters */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace("Equity Scheme - ", "")}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
              <input
                type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
              <input
                type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-600">
                  Schemes ({selectedCodes.size}/{allSchemes.length})
                </label>
              </div>
              <input
                type="text"
                placeholder="Search schemes..."
                value={schemeSearch}
                onChange={(e) => setSchemeSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1"
              />
              <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">All</span>
              </label>
              <div className="mt-1 max-h-64 overflow-y-auto space-y-0.5">
                {visibleSchemes.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-2">No schemes match.</p>
                ) : (
                  visibleSchemes.map((s) => (
                    <label key={s.scheme_code} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCodes.has(s.scheme_code)}
                        onChange={() => toggleOne(s.scheme_code)}
                        className="mt-0.5 rounded border-gray-300 text-blue-600 shrink-0"
                      />
                      <span className="text-xs text-gray-700 leading-tight">{s.scheme_name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleApply}
              disabled={selectedCodes.size === 0 || loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </aside>

        {/* Right panel — results table */}
        <div className="flex-1 min-w-0">
          {!hasApplied && !loading && (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400">
              Select schemes and click Apply to load statistics.
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {hasApplied && !loading && !error && rows.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-3">{rows.length} schemes</p>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-3 font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-56">Scheme</th>
                      <th className="px-2 py-3 font-medium text-gray-600 text-center w-10"></th>
                      <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>1Y Return</th>
                      <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>3Y Return</th>
                      <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>5Y Return</th>
                      <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>1Y Risk (SD)</th>
                      <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>3Y Risk (SD)</th>
                      <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>5Y Risk (SD)</th>
                    </tr>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                      <th className="sticky left-0 bg-gray-50" />
                      <th />
                      {["1Y Ret","3Y Ret","5Y Ret","1Y SD","3Y SD","5Y SD"].map((h) => (
                        <>
                          <th key={`${h}-min`} className="px-2 py-1 font-normal border-l border-gray-100 text-center">Min</th>
                          <th key={`${h}-max`} className="px-2 py-1 font-normal text-center">Max</th>
                          <th key={`${h}-avg`} className="px-2 py-1 font-normal text-center">Avg</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s) => (
                      <tr key={s.scheme_code} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                        <td className="px-3 py-2 sticky left-0 bg-white">
                          <div className="font-medium text-gray-900 leading-tight">{s.scheme_name}</div>
                          <div className="text-gray-400 mt-0.5">{s.fund_house}</div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            onClick={() => toggleWatchlist(s.scheme_code)}
                            disabled={watchlistBusy.has(s.scheme_code)}
                            title={watchlistCodes.has(s.scheme_code) ? "Remove from watchlist" : "Add to watchlist"}
                            className="text-lg leading-none disabled:opacity-40 hover:scale-110 transition-transform"
                          >
                            {watchlistCodes.has(s.scheme_code) ? "★" : "☆"}
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center border-l border-gray-100">{pct(s.min_return_1y)}</td>
                        <td className="px-2 py-2 text-center">{pct(s.max_return_1y)}</td>
                        <td className="px-2 py-2 text-center">{pct(s.avg_return_1y)}</td>
                        <td className="px-2 py-2 text-center border-l border-gray-100">{pct(s.min_return_3y)}</td>
                        <td className="px-2 py-2 text-center">{pct(s.max_return_3y)}</td>
                        <td className="px-2 py-2 text-center">{pct(s.avg_return_3y)}</td>
                        <td className="px-2 py-2 text-center border-l border-gray-100">{pct(s.min_return_5y)}</td>
                        <td className="px-2 py-2 text-center">{pct(s.max_return_5y)}</td>
                        <td className="px-2 py-2 text-center">{pct(s.avg_return_5y)}</td>
                        <td className="px-2 py-2 text-center border-l border-gray-100">{sd(s.min_sd_1y)}</td>
                        <td className="px-2 py-2 text-center">{sd(s.max_sd_1y)}</td>
                        <td className="px-2 py-2 text-center">{sd(s.avg_sd_1y)}</td>
                        <td className="px-2 py-2 text-center border-l border-gray-100">{sd(s.min_sd_3y)}</td>
                        <td className="px-2 py-2 text-center">{sd(s.max_sd_3y)}</td>
                        <td className="px-2 py-2 text-center">{sd(s.avg_sd_3y)}</td>
                        <td className="px-2 py-2 text-center border-l border-gray-100">{sd(s.min_sd_5y)}</td>
                        <td className="px-2 py-2 text-center">{sd(s.max_sd_5y)}</td>
                        <td className="px-2 py-2 text-center">{sd(s.avg_sd_5y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
