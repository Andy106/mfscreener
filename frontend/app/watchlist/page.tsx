"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WatchlistScheme {
  scheme_code: string;
  scheme_name: string;
  fund_house: string;
  scheme_category: string;
  scheme_type: string;
}

interface NavPoint {
  nav_date: string;
  nav_value: number;
}

interface ReturnSummary {
  min_return_1y: number | null; max_return_1y: number | null; avg_return_1y: number | null;
  min_return_3y: number | null; max_return_3y: number | null; avg_return_3y: number | null;
  min_return_5y: number | null; max_return_5y: number | null; avg_return_5y: number | null;
}

interface RiskSummary {
  min_sd_1y: number | null; max_sd_1y: number | null; avg_sd_1y: number | null;
  min_sd_3y: number | null; max_sd_3y: number | null; avg_sd_3y: number | null;
  min_sd_5y: number | null; max_sd_5y: number | null; avg_sd_5y: number | null;
}

function pct(v: number | null) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function pctColored(v: number | null) {
  if (v == null) return <span className="text-gray-300">—</span>;
  const color = v >= 0 ? "text-green-700" : "text-red-600";
  return <span className={color}>{(v * 100).toFixed(1)}%</span>;
}

function sdFmt(v: number | null) {
  if (v == null) return <span className="text-gray-300">—</span>;
  return <span className="text-gray-700">{(v * 100).toFixed(1)}%</span>;
}

function formatAxisDate(dateStr: string) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function formatTooltipDate(dateStr: string) {
  return dateStr;
}

export default function WatchlistPage() {
  const router = useRouter();
  const [schemes, setSchemes] = useState<WatchlistScheme[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [removingCode, setRemovingCode] = useState<string | null>(null);

  const [selected, setSelected] = useState<WatchlistScheme | null>(null);
  const [startDate, setStartDate] = useState("2015-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [navData, setNavData] = useState<NavPoint[]>([]);
  const [returnSummary, setReturnSummary] = useState<ReturnSummary | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("isLoggedIn")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    fetchWatchlist();
  }, []);

  function fetchWatchlist() {
    setLoadingList(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/watchlist`)
      .then((r) => r.json())
      .then((data: WatchlistScheme[]) => setSchemes(data))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }

  async function removeScheme(code: string) {
    setRemovingCode(code);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/watchlist/${code}`, { method: "DELETE" });
      setSchemes((prev) => prev.filter((s) => s.scheme_code !== code));
      if (selected?.scheme_code === code) {
        setSelected(null);
        setNavData([]);
        setReturnSummary(null);
        setRiskSummary(null);
        setHasApplied(false);
      }
    } finally {
      setRemovingCode(null);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("isLoggedIn");
    router.replace("/login");
  }

  function handleApply() {
    if (!selected) return;
    setLoadingDetail(true);
    setDetailError("");
    setHasApplied(true);

    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    const base = process.env.NEXT_PUBLIC_API_URL;
    const qs = params.toString();

    Promise.all([
      fetch(`${base}/nav/${selected.scheme_code}${qs ? `?${qs}` : ""}`).then((r) => r.json()),
      fetch(`${base}/returns_summary/${selected.scheme_code}${qs ? `?${qs}` : ""}`).then((r) => r.json()),
      fetch(`${base}/risk_summary/${selected.scheme_code}${qs ? `?${qs}` : ""}`).then((r) => r.json()),
    ])
      .then(([nav, ret, risk]) => {
        setNavData(
          (nav as { nav_date: string; nav_value: string }[]).map((p) => ({
            nav_date: p.nav_date,
            nav_value: parseFloat(String(p.nav_value)),
          }))
        );
        setReturnSummary(ret as ReturnSummary);
        setRiskSummary(risk as RiskSummary);
      })
      .catch((e) => setDetailError(e.message))
      .finally(() => setLoadingDetail(false));
  }

  // Thin the NAV data for chart performance: keep every Nth point
  const chartData = navData.length > 1000
    ? navData.filter((_, i) => i % Math.ceil(navData.length / 1000) === 0)
    : navData;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MFSelect</h1>
        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">Screener</Link>
          <span className="text-sm font-medium text-blue-600 border-b-2 border-blue-600 pb-0.5">Watchlist</span>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900">Logout</button>
        </nav>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 flex gap-6">

        {/* Left panel — watchlist */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Watchlist ({schemes.length})</h2>

            {loadingList ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : schemes.length === 0 ? (
              <p className="text-xs text-gray-400">
                No schemes saved.{" "}
                <Link href="/dashboard" className="text-blue-600 hover:underline">Go to Screener</Link>{" "}
                and click ☆ to add.
              </p>
            ) : (
              <div className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto">
                {schemes.map((s) => (
                  <div
                    key={s.scheme_code}
                    onClick={() => {
                      setSelected(s);
                      setNavData([]);
                      setReturnSummary(null);
                      setRiskSummary(null);
                      setHasApplied(false);
                      setDetailError("");
                    }}
                    className={`flex items-start justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selected?.scheme_code === s.scheme_code
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-900 leading-tight truncate">{s.scheme_name}</div>
                      <div className="text-xs text-gray-400 truncate">{s.fund_house}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeScheme(s.scheme_code); }}
                      disabled={removingCode === s.scheme_code}
                      title="Remove from watchlist"
                      className="shrink-0 text-gray-300 hover:text-red-400 disabled:opacity-40 text-base leading-none"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right panel — detail */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selected ? (
            <div className="flex items-center justify-center h-64 text-sm text-gray-400">
              Select a scheme from the watchlist to view details.
            </div>
          ) : (
            <>
              {/* Scheme header */}
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{selected.scheme_name}</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{selected.fund_house}</p>
                  </div>
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                      {selected.scheme_category.replace("Equity Scheme - ", "")}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {selected.scheme_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Date filters + Apply */}
              <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-end gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                  <input
                    type="date" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                  <input
                    type="date" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleApply}
                  disabled={loadingDetail}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {loadingDetail ? "Loading…" : "Apply"}
                </button>
              </div>

              {detailError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {detailError}
                </div>
              )}

              {hasApplied && !loadingDetail && !detailError && (
                <>
                  {/* NAV trend chart */}
                  <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">Daily NAV Trend</h3>
                    {chartData.length === 0 ? (
                      <p className="text-xs text-gray-400">No NAV data for the selected date range.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="nav_date"
                            tickFormatter={formatAxisDate}
                            tick={{ fontSize: 11 }}
                            minTickGap={60}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => `₹${v.toFixed(0)}`}
                            width={60}
                          />
                          <Tooltip
                            labelFormatter={(label) => String(label)}
                            formatter={(v) => [`₹${Number(v).toFixed(4)}`, "NAV"]}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="nav_value"
                            stroke="#2563eb"
                            dot={false}
                            strokeWidth={1.5}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Returns & Risk summary table */}
                  {(returnSummary || riskSummary) && (
                    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                      <h3 className="text-sm font-semibold text-gray-800 mb-4">Rolling Returns & Risk Summary</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 text-gray-500">
                              <th className="text-left py-2 pr-4 font-medium">Metric</th>
                              <th className="text-center px-3 py-2 font-medium border-l border-gray-100">Min</th>
                              <th className="text-center px-3 py-2 font-medium">Max</th>
                              <th className="text-center px-3 py-2 font-medium">Avg</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {returnSummary && (
                              <>
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-700">1Y Rolling Return</td>
                                  <td className="text-center px-3 py-2 border-l border-gray-100">{pctColored(returnSummary.min_return_1y)}</td>
                                  <td className="text-center px-3 py-2">{pctColored(returnSummary.max_return_1y)}</td>
                                  <td className="text-center px-3 py-2">{pctColored(returnSummary.avg_return_1y)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-700">3Y Rolling Return</td>
                                  <td className="text-center px-3 py-2 border-l border-gray-100">{pctColored(returnSummary.min_return_3y)}</td>
                                  <td className="text-center px-3 py-2">{pctColored(returnSummary.max_return_3y)}</td>
                                  <td className="text-center px-3 py-2">{pctColored(returnSummary.avg_return_3y)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-700">5Y Rolling Return</td>
                                  <td className="text-center px-3 py-2 border-l border-gray-100">{pctColored(returnSummary.min_return_5y)}</td>
                                  <td className="text-center px-3 py-2">{pctColored(returnSummary.max_return_5y)}</td>
                                  <td className="text-center px-3 py-2">{pctColored(returnSummary.avg_return_5y)}</td>
                                </tr>
                              </>
                            )}
                            {riskSummary && (
                              <>
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-700">1Y Rolling SD (Risk)</td>
                                  <td className="text-center px-3 py-2 border-l border-gray-100">{sdFmt(riskSummary.min_sd_1y)}</td>
                                  <td className="text-center px-3 py-2">{sdFmt(riskSummary.max_sd_1y)}</td>
                                  <td className="text-center px-3 py-2">{sdFmt(riskSummary.avg_sd_1y)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-700">3Y Rolling SD (Risk)</td>
                                  <td className="text-center px-3 py-2 border-l border-gray-100">{sdFmt(riskSummary.min_sd_3y)}</td>
                                  <td className="text-center px-3 py-2">{sdFmt(riskSummary.max_sd_3y)}</td>
                                  <td className="text-center px-3 py-2">{sdFmt(riskSummary.avg_sd_3y)}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 pr-4 font-medium text-gray-700">5Y Rolling SD (Risk)</td>
                                  <td className="text-center px-3 py-2 border-l border-gray-100">{sdFmt(riskSummary.min_sd_5y)}</td>
                                  <td className="text-center px-3 py-2">{sdFmt(riskSummary.max_sd_5y)}</td>
                                  <td className="text-center px-3 py-2">{sdFmt(riskSummary.avg_sd_5y)}</td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
