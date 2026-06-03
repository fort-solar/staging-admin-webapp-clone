"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { CreateCustomerModal } from "@/components/dashboard/create-customer-modal";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { Avatar, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu } from "@/components/dashboard/ui";
import { EyeIcon, PlusIcon } from "@/components/dashboard/icons";
import { DEFAULT_PAGE_SIZE, formatManagedUserStatusLabel, getCustomers } from "@/lib/admin-api";
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
  const [openModal, setOpenModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canCreateCustomers = can("customers", "create");
  const canUpdateCustomers = can("customers", "update");

  useEffect(() => {
    let cancelled = false;

    getCustomers({
      page,
      limit: DEFAULT_PAGE_SIZE,
      search: deferredQuery.trim() || undefined,
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
  }, [deferredQuery, page, refreshKey]);

  function handlePageChange(nextPage: number) {
    setIsLoading(true);
    setError(null);
    setPage(nextPage);
  }

  function handleSearchChange(nextQuery: string) {
    setIsLoading(true);
    setError(null);
    setQuery(nextQuery);
    setPage(1);
  }

  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(rows.map((customer) => formatManagedUserStatusLabel(customer.status))))], [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((customer) => {
        const labelStatus = formatManagedUserStatusLabel(customer.status);
        const matchesStatus = status === "All" || labelStatus === status;
        return matchesStatus;
      }),
    [rows, status],
  );

  const activeCustomers = rows.filter((customer) => customer.status.toLowerCase() === "active").length;
  const verifiedCustomers = rows.filter((customer) => customer.emailVerified).length;

  return (
    <>
      <div className="dashboard-stack">
        <section className="stats-grid--three">
          <MetricCardSecondary title="Total Customers" value={pagination.total.toLocaleString()} icon="customers" spark={[14, 24, 30, 42, 56, 62]} />
          <MetricCardSecondary title="Active On This Page" value={activeCustomers.toLocaleString()} icon="installers" spark={[18, 22, 28, 36, 44, 52]} />
          <MetricCardSecondary title="Verified Emails" value={verifiedCustomers.toLocaleString()} icon="verification" spark={[56, 52, 46, 40, 36, 30]} />
        </section>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Customer Directory"
            action={
              canCreateCustomers ? (
                <button type="button" className="action-button is-primary is-sm" onClick={() => setOpenModal(true)}>
                  <PlusIcon className="mini-icon" />
                  <span>Create Customer</span>
                </button>
              ) : undefined
            }
          />
          <div className="dashboard-table-toolbar">
            <SearchField
              value={query}
              onChange={handleSearchChange}
              placeholder="Search customers..."
            />
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
                        const statusLabel = formatManagedUserStatusLabel(customer.status);

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
                          <div className="flex flex-col items-center gap-3 py-4 text-center">
                            <span>{isLoading ? "Loading customers..." : "No customers matched the current filters."}</span>
                            {!isLoading && canCreateCustomers ? (
                              <button type="button" className="action-button is-secondary is-sm" onClick={() => setOpenModal(true)}>
                                <PlusIcon className="mini-icon" />
                                <span>Create Customer</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={Math.max(pagination.totalPages, 1)} onChange={handlePageChange} />
            </>
          )}
        </Panel>
      </div>

      <CreateCustomerModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        initialValues={query ? { email: query.includes("@") ? query.trim() : "", name: query.includes("@") ? "" : query.trim() } : undefined}
        onCreated={() => {
          setIsLoading(true);
          setError(null);
          setPage(1);
          setRefreshKey((current) => current + 1);
        }}
      />
    </>
  );
}
