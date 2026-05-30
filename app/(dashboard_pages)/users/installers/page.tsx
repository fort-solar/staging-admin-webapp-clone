"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { BanIcon, EyeIcon, TrashIcon } from "@/components/dashboard/icons";
import { Avatar, Checkbox, EmptyScaffold, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu, cx } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { isDashboardActionCancelledError, isDashboardSessionExpiredError } from "@/lib/api/client";
import { DEFAULT_PAGE_SIZE, deleteInstaller, formatManagedUserStatusLabel, getBundleRequests, getInstallers, updateInstaller } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import { toneFromStatus } from "@/lib/dashboard-data";
import type { InstallerRecord, PaginationMeta } from "@/types/api.types";

const emptyPagination: PaginationMeta = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

export default function InstallersPage() {
  const { can } = useAccessControl();
  const { toast } = useToast();
  const pathname = usePathname();
  const [rows, setRows] = useState<InstallerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingInstallations, setPendingInstallations] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const canUpdateInstallers = can("installers", "update");
  const canDeleteInstallers = can("installers", "delete");

  useEffect(() => {
    let cancelled = false;

    getInstallers({ page, limit: DEFAULT_PAGE_SIZE })
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

        setError(getErrorMessage(loadError, "Installers could not be loaded."));
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
  }, [page, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    getBundleRequests({ page: 1, limit: 100 })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setPendingInstallations(
          payload.data.filter((request) => !["closed", "cancelled", "canceled"].includes(request.status.trim().toLowerCase())).length,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setPendingInstallations(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handlePageChange(nextPage: number) {
    setIsLoading(true);
    setError(null);
    setPage(nextPage);
  }

  const statusOptions = useMemo(() => ["All", ...Array.from(new Set(rows.map((installer) => formatManagedUserStatusLabel(installer.user.status))))], [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((installer) => {
        const statusLabel = formatManagedUserStatusLabel(installer.user.status);
        const haystack = [
          installer.user.id,
          installer.user.name,
          installer.user.fullName,
          installer.user.email,
          installer.user.phone ?? "",
          installer.user.address ?? "",
          installer.installerProfile.companyName ?? "",
          installer.installerProfile.city ?? "",
          installer.installerProfile.state ?? "",
          statusLabel,
        ]
          .join(" ")
          .toLowerCase();

        const matchesQuery = haystack.includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || statusLabel === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, rows, status],
  );

  const activeInstallers = rows.filter((installer) => installer.user.status.toLowerCase() === "active").length;
  const availableInstallers = rows.filter((installer) => installer.installerProfile.availabilityStatus?.toLowerCase() === "available").length;
  async function handleToggleStatus(installer: InstallerRecord) {
    const nextStatus = installer.user.status.toLowerCase() === "active" ? "inactive" : "active";

    try {
      await updateInstaller(installer.user.id, {
        name: installer.user.fullName || installer.user.name,
        phone: installer.user.phone ?? "",
        address: installer.user.address ?? "",
        status: nextStatus,
      });
      toast({
        title: "Installer updated",
        description: `${installer.user.fullName || installer.user.name} is now ${formatManagedUserStatusLabel(nextStatus).toLowerCase()}.`,
        variant: "success",
      });
      setIsLoading(true);
      setError(null);
      setRefreshKey((value) => value + 1);
    } catch (updateError) {
      if (isDashboardActionCancelledError(updateError) || isDashboardSessionExpiredError(updateError)) {
        return;
      }

      toast({
        title: "Update failed",
        description: getErrorMessage(updateError, "The installer status could not be updated."),
        variant: "error",
      });
    }
  }

  async function handleDelete(installer: InstallerRecord) {
    try {
      await deleteInstaller(installer.user.id);
      toast({
        title: "Installer deleted",
        description: `${installer.user.fullName || installer.user.name} was removed successfully.`,
        variant: "success",
      });

      setIsLoading(true);
      setError(null);
      if (rows.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        setRefreshKey((value) => value + 1);
      }
    } catch (deleteError) {
      if (isDashboardActionCancelledError(deleteError) || isDashboardSessionExpiredError(deleteError)) {
        return;
      }

      toast({
        title: "Delete failed",
        description: getErrorMessage(deleteError, "The installer could not be deleted."),
        variant: "error",
      });
    }
  }

  return (
    <div className="dashboard-stack">
      <div className="inline-actions">
        <Link href="/users/installers" className={cx("action-button is-sm", pathname === "/users/installers" ? "is-primary" : "is-secondary")}>
          Installer Directory
        </Link>
        <Link href="/dashboard/verification-queue" className={cx("action-button is-sm", pathname === "/dashboard/verification-queue" ? "is-primary" : "is-secondary")}>
          Verification Queue
        </Link>
      </div>

      <section className="stats-grid--four">
        <MetricCardSecondary title="Total Installers" value={pagination.total.toLocaleString()} icon="installers" spark={[18, 24, 36, 48, 56, 60]} />
        <MetricCardSecondary title="Active On This Page" value={activeInstallers.toLocaleString()} icon="verification" spark={[12, 18, 26, 34, 46, 54]} />
        <MetricCardSecondary title="Available Installers" value={availableInstallers.toLocaleString()} icon="admins" spark={[18, 22, 26, 30, 34, 40]} />
        <MetricCardSecondary title="Pending Installations" value={pendingInstallations.toLocaleString()} icon="flag" spark={[44, 42, 36, 28, 22, 18]} />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Installer Directory" />
        <div className="dashboard-table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search installers..." />
          <div className="inline-actions">
            <SelectField value={status} onChange={setStatus} options={statusOptions} />
          </div>
        </div>

        <ErrorMessage title="Installer load failed" message={error} className="mx-6 mt-4" />

        {!isLoading && !rows.length && !error ? (
          <div className="p-6">
            <EmptyScaffold title="No installers found" description="No record found on the database" />
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
                    <th>Installer</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Experience</th>
                    <th>Rating</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? (
                    filteredRows.map((installer) => (
                      <tr key={installer.user.id}>
                        <td className="table-checkbox-cell">
                          <Checkbox />
                        </td>
                        <td>
                          <div className="person-cell">
                            <Avatar src={installer.user.avatar_url ?? undefined} alt={installer.user.fullName || installer.user.name} size="sm" />
                            <div className="person-cell__text">
                              <strong>{installer.user.fullName || installer.user.name}</strong>
                              <span>{installer.user.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>{installer.installerProfile.companyName || "N/A"}</td>
                        <td>{[installer.installerProfile.city, installer.installerProfile.state].filter(Boolean).join(", ") || "N/A"}</td>
                        <td>{installer.installerProfile.experienceYears ?? 0} yrs</td>
                        <td>{installer.installerProfile.rating ? `${installer.installerProfile.rating.toFixed(1)} / 5` : "N/A"}</td>
                        <td>
                          <StatusPill label={formatManagedUserStatusLabel(installer.user.status)} tone={toneFromStatus(installer.user.status)} />
                        </td>
                        <td>
                          <div className="inline-actions justify-end">
                            <Link href={`/users/installers/${installer.user.id}`} className="inline-flex">
                              <button type="button" className="icon-button" aria-label={`View ${installer.user.fullName || installer.user.name}`}>
                                <EyeIcon className="menu-icon" />
                              </button>
                            </Link>
                            <TableActionsMenu
                              panelClassName="is-installer-menu"
                              items={[
                                { label: "View Profile", href: `/users/installers/${installer.user.id}`, icon: <EyeIcon className="menu-icon" /> },
                                ...(canUpdateInstallers
                                  ? [
                                      {
                                        label: installer.user.status.toLowerCase() === "active" ? "Deactivate Installer" : "Activate Installer",
                                        icon: <BanIcon className="menu-icon" />,
                                        onSelect: () => handleToggleStatus(installer),
                                      },
                                    ]
                                  : []),
                                ...(canDeleteInstallers
                                  ? [
                                      {
                                        label: "Delete Installer",
                                        tone: "danger" as const,
                                        icon: <TrashIcon className="menu-icon" />,
                                        onSelect: () => handleDelete(installer),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="cell-subtle">
                        {isLoading ? "Loading installers..." : "No installers matched the current filters."}
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
  );
}
