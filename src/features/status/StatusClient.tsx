"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProxyHealth } from "@/lib/apiClient";
import type { ProxyHealthResponse } from "@/types/api";

const POLL_INTERVAL_MS = 30_000;
const MAX_HISTORY = 20;

type HistoryEntry = ProxyHealthResponse & { id: number };

let nextId = 0;

function statusLabel(status: ProxyHealthResponse["status"]): string {
  switch (status) {
    case "ok":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "down":
      return "Down";
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

export function StatusClient(): JSX.Element {
  const [latest, setLatest] = useState<ProxyHealthResponse | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await fetchProxyHealth();
      setLatest(result);
      setHistory((prev) => [{ ...result, id: nextId++ }, ...prev].slice(0, MAX_HISTORY));
    } catch {
      const fallback: ProxyHealthResponse = {
        status: "down",
        proxyConfigured: false,
        latencyMs: null,
        httpStatus: null,
        checkedAt: new Date().toISOString(),
        cached: false,
        error: "Health check request failed"
      };
      setLatest(fallback);
      setHistory((prev) => [{ ...fallback, id: nextId++ }, ...prev].slice(0, MAX_HISTORY));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(runCheck, POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, runCheck]);

  return (
    <div className="page-wrap">
      <section className="card">
        <h2>Proxy Status</h2>
        <p className="muted">
          YouTube proxy connectivity check. Probes YouTube through the configured proxy every 30 seconds.
        </p>

        {latest ? (
          <div className={`status-banner status-banner-${latest.status}`}>
            <span className={`status-dot status-${latest.status}`} />
            <strong>{statusLabel(latest.status)}</strong>
          </div>
        ) : null}

        <div className="status-details">
          <div className="status-detail-item">
            <span className="status-detail-label">Proxy configured</span>
            <span>{latest ? (latest.proxyConfigured ? "Yes" : "No") : "—"}</span>
          </div>
          <div className="status-detail-item">
            <span className="status-detail-label">Latency</span>
            <span>{latest?.latencyMs != null ? `${latest.latencyMs} ms` : "—"}</span>
          </div>
          <div className="status-detail-item">
            <span className="status-detail-label">HTTP status</span>
            <span>{latest?.httpStatus != null ? latest.httpStatus : "—"}</span>
          </div>
          <div className="status-detail-item">
            <span className="status-detail-label">Last checked</span>
            <span>{latest ? formatTime(latest.checkedAt) : "—"}</span>
          </div>
          <div className="status-detail-item">
            <span className="status-detail-label">Cached</span>
            <span>{latest ? (latest.cached ? "Yes" : "No") : "—"}</span>
          </div>
          {latest?.error ? (
            <div className="status-detail-item status-detail-full">
              <span className="status-detail-label">Error</span>
              <span className="status-error-text">{latest.error}</span>
            </div>
          ) : null}
        </div>

        <div className="actions-row" style={{ marginTop: "0.75rem" }}>
          <button
            className="btn secondary"
            type="button"
            onClick={runCheck}
            disabled={checking}
          >
            {checking ? "Checking..." : "Check Now"}
          </button>
          <label className="proxy-toggle" style={{ marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="card">
          <h3>Check History</h3>
          <p className="muted">Last {history.length} checks (client-side only, resets on navigation).</p>
          <div className="status-history-table-wrap">
            <table className="status-history-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>HTTP</th>
                  <th>Time</th>
                  <th>Cached</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className={`status-dot status-${entry.status}`} />
                      {statusLabel(entry.status)}
                    </td>
                    <td>{entry.latencyMs != null ? `${entry.latencyMs} ms` : "—"}</td>
                    <td>{entry.httpStatus ?? "—"}</td>
                    <td>{formatTime(entry.checkedAt)}</td>
                    <td>{entry.cached ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
