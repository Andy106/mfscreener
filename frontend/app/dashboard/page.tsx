"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SchemeRow {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  scheme_category: string;
  scheme_type: string;
  min_return_1y: number | null;
  max_return_1y: number | null;
  avg_return_1y: number | null;
  min_return_3y: number | null;
  max_return_3y: number | null;
  avg_return_3y: number | null;
  min_return_5y: number | null;
  max_return_5y: number | null;
  avg_return_5y: number | null;
  min_sd_1y: number | null;
  max_sd_1y: number | null;
  avg_sd_1y: number | null;
  min_sd_3y: number | null;
  max_sd_3y: number | null;
  avg_sd_3y: number | null;
  min_sd_5y: number | null;
  max_sd_5y: number | null;
  avg_sd_5y: number | null;
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

function MinMaxAvg({
  min, max, avg, fmt,
}: {
  min: number | null;
  max: number | null;
  avg: number | null;
  fmt: (v: number | null) => React.ReactNode;
}) {
  return (
    <div className="text-xs space-y-0.5 text-center">
      <div><span className="text-gray-400 mr-0.5">mn</span>{fmt(min)}</div>
      <div><span className="text-gray-400 mr-0.5">mx</span>{fmt(max)}</div>
      <div><span className="text-gray-400 mr-0.5">av</span>{fmt(avg)}</div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<SchemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("2015-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!sessionStorage.getItem("isLoggedIn")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ category });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/screener?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SchemeRow[]) => setRows(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, startDate, endDate]);

  function handleLogout() {
    sessionStorage.removeItem("isLoggedIn");
    router.replace("/login");
  }

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return r.scheme_name.toLowerCase().includes(q) || r.fund_house.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MFSelect</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">
          Logout
        </button>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("Equity Scheme - ", "")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="text"
              placeholder="Scheme or fund house..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none w-56"
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading...</div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Failed to load: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="text-xs text-gray-400 mb-3">{filtered.length} schemes</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-3 font-medium text-gray-600 sticky left-0 bg-gray-50 min-w-64">Scheme</th>
                    <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>1Y Return</th>
                    <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>3Y Return</th>
                    <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>5Y Return</th>
                    <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>1Y Risk (SD)</th>
                    <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>3Y Risk (SD)</th>
                    <th className="px-3 py-3 font-medium text-gray-600 text-center border-l border-gray-200" colSpan={3}>5Y Risk (SD)</th>
                  </tr>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-400">
                    <th className="sticky left-0 bg-gray-50" />
                    {["1Y Return","3Y Return","5Y Return","1Y SD","3Y SD","5Y SD"].map((h) => (
                      <>
                        <th key={`${h}-min`} className="px-2 py-1 font-normal border-l border-gray-100 text-center">Min</th>
                        <th key={`${h}-max`} className="px-2 py-1 font-normal text-center">Max</th>
                        <th key={`${h}-avg`} className="px-2 py-1 font-normal text-center">Avg</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.scheme_code} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                      <td className="px-3 py-2 sticky left-0 bg-white">
                        <div className="font-medium text-gray-900 leading-tight">{s.scheme_name}</div>
                        <div className="text-gray-400 mt-0.5">{s.fund_house}</div>
                      </td>
                      {/* 1Y Return */}
                      <td className="px-2 py-2 text-center border-l border-gray-100">{pct(s.min_return_1y)}</td>
                      <td className="px-2 py-2 text-center">{pct(s.max_return_1y)}</td>
                      <td className="px-2 py-2 text-center">{pct(s.avg_return_1y)}</td>
                      {/* 3Y Return */}
                      <td className="px-2 py-2 text-center border-l border-gray-100">{pct(s.min_return_3y)}</td>
                      <td className="px-2 py-2 text-center">{pct(s.max_return_3y)}</td>
                      <td className="px-2 py-2 text-center">{pct(s.avg_return_3y)}</td>
                      {/* 5Y Return */}
                      <td className="px-2 py-2 text-center border-l border-gray-100">{pct(s.min_return_5y)}</td>
                      <td className="px-2 py-2 text-center">{pct(s.max_return_5y)}</td>
                      <td className="px-2 py-2 text-center">{pct(s.avg_return_5y)}</td>
                      {/* 1Y SD */}
                      <td className="px-2 py-2 text-center border-l border-gray-100">{sd(s.min_sd_1y)}</td>
                      <td className="px-2 py-2 text-center">{sd(s.max_sd_1y)}</td>
                      <td className="px-2 py-2 text-center">{sd(s.avg_sd_1y)}</td>
                      {/* 3Y SD */}
                      <td className="px-2 py-2 text-center border-l border-gray-100">{sd(s.min_sd_3y)}</td>
                      <td className="px-2 py-2 text-center">{sd(s.max_sd_3y)}</td>
                      <td className="px-2 py-2 text-center">{sd(s.avg_sd_3y)}</td>
                      {/* 5Y SD */}
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
      </main>
    </div>
  );
}
