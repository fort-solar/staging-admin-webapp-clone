"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { Avatar, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu } from "@/components/dashboard/ui";
import { EyeIcon } from "@/components/dashboard/icons";
import { DEFAULT_PAGE_SIZE, formatEnumLabel, getCustomers } from "@/lib/admin-api";
import { toneFromStatus } from "@/lib/dashboard-data";
import { getErrorMessage } from "@/lib/api/errors";
import type { CustomerRecord, PaginationMeta } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

export default function CustomersPage() {
  const { can } = useAccessControl();
  const [rows, setRows] = useState<CustomerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);
  const canUpdateCustomers = can("customers", "update");

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getCustomers({ page, limit: DEFAULT_PAGE_SIZE })
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

        setError(getErrorMessage(loadError, "Customers could not be loaded."));
        setRows([]);
        setPagination(emptyPagination);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(rows.map((customer) => formatEnumLabel(customer.status))))], [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((customer) => {
        const labelStatus = formatEnumLabel(customer.status);
        const haystack = [
          customer.id,
          customer.name,
          customer.fullName,
          customer.email,
          customer.phone ?? "",
          customer.address ?? "",
          labelStatus,
        ]
          .join(" ")
          .toLowerCase();

        const matchesQuery = haystack.includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || labelStatus === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  const activeCustomers = rows.filter((customer) => customer.status.toLowerCase() === "active").length;
  const verifiedCustomers = rows.filter((customer) => customer.emailVerified).length;

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary title="Total Customers" value={pagination.total.toLocaleString()} icon="customers" spark={[14, 24, 30, 42, 56, 62]} />
        <MetricCardSecondary title="Active On This Page" value={activeCustomers.toLocaleString()} icon="installers" spark={[18, 22, 28, 36, 44, 52]} />
        <MetricCardSecondary title="Verified Emails" value={verifiedCustomers.toLocaleString()} icon="verification" spark={[56, 52, 46, 40, 36, 30]} />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Customer Directory" />
        <div className="dashboard-table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search customers..." />
          <div className="inline-actions">
            <SelectField value={status} onChange={setStatus} options={statusOptions} />
          </div>
        </div>

        <ErrorMessage title="Customer load failed" message={error} className="mx-6 mt-4" />

        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No customers found" description="No record found on the database" />
          </div>
        ) : (
          <>
            <div className="table-scroll pt-2">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className="table-checkbox-cell">
                      <Checkbox />
                    </th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Email Verified</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? (
                    filteredRows.map((customer) => {
                      const statusLabel = formatEnumLabel(customer.status);

                      return (
                        <tr key={customer.id}>
                          <td className="table-checkbox-cell">
                            <Checkbox />
                          </td>
                          <td>
                            <div className="person-cell">
                              <Avatar src={customer.avatar_url ?? undefined} alt={customer.fullName || customer.name} size="sm" />
                              <div className="person-cell__text">
                                <strong>{customer.fullName || customer.name}</strong>
                                <span>{customer.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>{customer.phone || "N/A"}</td>
                          <td>{customer.address || "N/A"}</td>
                          <td>{customer.emailVerified ? "Yes" : "No"}</td>
                          <td>
                            <StatusPill label={statusLabel} tone={toneFromStatus(customer.status)} />
                          </td>
                          <td>
                            <div className="inline-actions justify-end">
                              <Link href={`/users/customers/${customer.id}`} className="inline-flex">
                                <button type="button" className="icon-button" aria-label={`View ${customer.fullName || customer.name}`}>
                                  <EyeIcon className="menu-icon" />
                                </button>
                              </Link>
                              <TableActionsMenu
                                items={[
                                  { label: "View Details", href: `/users/customers/${customer.id}`, icon: <EyeIcon className="menu-icon" /> },
                                  ...(canUpdateCustomers ? [{ label: "Edit Customer", href: `/users/customers/${customer.id}` }] : []),
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="cell-subtle">
                        {isLoading ? "Loading customers..." : "No customers matched the current filters."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={setPage} />
          </>
        )}
      </Panel>
    </div>
  );
}
