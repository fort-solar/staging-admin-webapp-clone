"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ActivityListItem, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField } from "@/components/dashboard/ui";
import { normalizeAdminActivity } from "@/lib/admin-activity";
import { DEFAULT_PAGE_SIZE, getAdminActivity } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { AdminActivityRecord, PaginationMeta } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

export default function ActivityHistoryPage() {
  const [rows, setRows] = useState<AdminActivityRecord[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedRows = rows.map(normalizeAdminActivity);

  useEffect(() => {
    let cancelled = false;

    getAdminActivity({
      scope: "all",
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
      q: deferredQuery.trim() || undefined,
    })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRows(payload.data);
        setPagination(payload.pagination);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setRows([]);
        setPagination(emptyPagination);
        setError(getErrorMessage(loadError, "Activity history could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, page]);

  function handleSearchChange(value: string) {
    setIsLoading(true);
    setError(null);
    setPage(1);
    setQuery(value);
  }

  function handlePageChange(nextPage: number) {
    setIsLoading(true);
    setError(null);
    setPage(nextPage);
  }

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary title="Total Activity Records" value={pagination.total.toLocaleString()} icon="admins" spark={[12, 18, 24, 32, 40, 46]} />
        <MetricCardSecondary title="Current Page" value={pagination.page.toLocaleString()} icon="calendar" spark={[16, 20, 24, 28, 30, 34]} />
        <MetricCardSecondary title="Entries This View" value={rows.length.toLocaleString()} icon="notifications" spark={[10, 16, 18, 22, 26, 28]} />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Activity History" />

        <div className="dashboard-table-toolbar">
          <SearchField value={query} onChange={handleSearchChange} placeholder="Search activity history..." />
        </div>

        <ErrorMessage title="Activity history load failed" message={error} className="mx-6 mt-4" />

        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No activity found" description="No audit history matched the current query." />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 p-6">
              {normalizedRows.length ? (
                normalizedRows.map((item) => (
                  <article key={item.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                    <ActivityListItem title={item.title} description={item.description} meta={item.meta} tone={item.tone} />
                    {item.detailEntries.length ? (
                      <div className="mt-4 grid gap-2 text-sm text-[var(--text-soft)] sm:grid-cols-2">
                        {item.detailEntries.slice(0, 4).map((entry) => (
                          <div key={`${item.id}-${entry.label}`} className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                            <strong className="block text-[var(--text)]">{entry.label}</strong>
                            <span>{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="p-2 text-sm text-[var(--text-soft)]">{isLoading ? "Loading activity history..." : "No activity records matched the current filters."}</div>
              )}
            </div>

            <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={handlePageChange} />
          </>
        )}
      </Panel>
    </div>
  );
}
