"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ErrorMessage } from "@/components/dashboard/error-message";
import {
  EmptyScaffold,
  MetricCardSecondary,
  Pagination,
  Panel,
  PanelHeader,
  SearchField,
  SelectField,
  StatusPill,
} from "@/components/dashboard/ui";
import { DEFAULT_PAGE_SIZE, formatDateTimeLabel, getNewsletterSubscribers } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { NewsletterSubscriberRecord, PaginationMeta } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

const statusFilterOptions = ["All", "Active Only", "Inactive / Unsubscribed"];

export default function SubscribersPage() {
  const [rows, setRows] = useState<NewsletterSubscriberRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const activeOnly = statusFilter === "Active Only" ? true : statusFilter === "Inactive / Unsubscribed" ? false : undefined;

    getNewsletterSubscribers({
      page,
      limit,
      activeOnly,
    })
      .then((payload) => {
        if (cancelled) return;

        const list = Array.isArray(payload.data) ? payload.data : [];
        setRows(list);
        setPagination(payload.pagination ?? emptyPagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, limit, statusFilter]);

  function handlePageChange(nextPage: number) {
    setPage(nextPage);
  }

  function handleSearchChange(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  const filteredRows = useMemo(() => {
    if (!deferredQuery.trim()) return rows;
    const q = deferredQuery.toLowerCase().trim();
    return rows.filter((r) =>
      r.email.toLowerCase().includes(q) || (r.name && r.name.toLowerCase().includes(q))
    );
  }, [rows, deferredQuery]);

  const activeCount = rows.filter((r) => r.is_active).length;
  const inactiveCount = rows.filter((r) => !r.is_active).length;

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary
          title="Total Subscribers"
          value={pagination.total.toLocaleString()}
          icon="customers"
          spark={[12, 18, 25, 34, 45, 58]}
        />
        <MetricCardSecondary
          title="Active On This Page"
          value={activeCount.toLocaleString()}
          icon="installers"
          spark={[10, 16, 22, 30, 40, 52]}
        />
        <MetricCardSecondary
          title="Unsubscribed / Inactive"
          value={inactiveCount.toLocaleString()}
          icon="verification"
          spark={[2, 3, 2, 4, 3, 5]}
        />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Newsletter Subscribers" />
        <div className="dashboard-table-toolbar">
          <SearchField
            value={query}
            onChange={handleSearchChange}
            placeholder="Search by email or name..."
          />
          <div className="inline-actions">
            <SelectField
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
            />
          </div>
        </div>

        <ErrorMessage title="Subscriber load failed" message={error} className="mx-6 mt-4" />

        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold
              title="No subscribers found"
              description="Subscribers from fortsolar.ng newsletter signups will appear here."
            />
          </div>
        ) : (
          <>
            <div className="table-scroll pt-2">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Display Name</th>
                    <th>Subscribed Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? (
                    filteredRows.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <span className="font-semibold text-neutral-900">{sub.email}</span>
                        </td>
                        <td>{sub.name || "—"}</td>
                        <td>{formatDateTimeLabel(sub.subscribed_at || sub.created_at)}</td>
                        <td>
                          <StatusPill
                            label={sub.is_active ? "Active" : "Unsubscribed"}
                            tone={sub.is_active ? "success" : "neutral"}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="cell-subtle">
                        <div className="flex flex-col items-center gap-3 py-6 text-center">
                          <span>{isLoading ? "Loading subscribers..." : "No subscribers matched the current filter."}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pagination.page}
              totalPages={Math.max(1, pagination.totalPages)}
              onChange={handlePageChange}
              limit={limit}
              onLimitChange={setLimit}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
