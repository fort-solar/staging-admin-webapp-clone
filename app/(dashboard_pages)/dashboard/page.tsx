"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { ApproveVerificationDialog, VerificationDocumentsDialog } from "@/components/dashboard/verification-dialogs";
import { ActivityListItem, Avatar, Button, IconButton, MetricCard, MetricCardSecondary, Panel, PanelHeader, RevenueChart, SearchField, StatusPill, cx } from "@/components/dashboard/ui";
import { ChevronDownIcon, EyeIcon, FilterIcon } from "@/components/dashboard/icons";
import { normalizeAdminActivity } from "@/lib/admin-activity";
import { approveVerification, formatCurrencyLabel, formatDateTimeLabel, formatEnumLabel, getAdminActivity, getDashboardOverview, getOrders, getVerificationSubmission, getVerificationSubmissions } from "@/lib/admin-api";
import { revenueSeries, toneFromStatus, type ChartPeriod, type MetricIconName, type MetricPeriod } from "@/lib/dashboard-data";
import { getErrorMessage } from "@/lib/api/errors";
import type { AdminActivityRecord, DashboardOverview, OrderRecord, VerificationSubmissionDetail, VerificationSubmissionRecord } from "@/types/api.types";

const periodOptions = [
  { value: "all" as const, label: "All" },
  { value: "yearly" as const, label: "Yearly" },
  { value: "monthly" as const, label: "Monthly" },
  { value: "weekly" as const, label: "Weekly" },
];

const recentOrderStatusOptions = ["pending", "processing", "completed", "cancelled"] as const;
const metricIcons = new Set<MetricIconName>(["wallet", "sales", "orders", "products", "installers", "customers", "bundles", "notifications", "calendar", "verification", "admins", "retention", "flag"]);

type RecentOrderFilter = "all" | (typeof recentOrderStatusOptions)[number];

function normalizeMetricIcon(value: string | undefined, fallback: MetricIconName) {
  if (!value) {
    return fallback;
  }

  return metricIcons.has(value as MetricIconName) ? (value as MetricIconName) : fallback;
}

function normalizeMetricPeriod(value: string | undefined): MetricPeriod | undefined {
  if (value === "daily" || value === "weekly" || value === "monthly" || value === "quarterly" || value === "yearly") {
    return value;
  }

  return undefined;
}

export default function DashboardPage() {
  const { can } = useAccessControl();
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [queue, setQueue] = useState<VerificationSubmissionRecord[]>([]);
  const [recentOrdersData, setRecentOrdersData] = useState<OrderRecord[]>([]);
  const [recentActivityRows, setRecentActivityRows] = useState<AdminActivityRecord[]>([]);
  const [documentsId, setDocumentsId] = useState<string | null>(null);
  const [documentDetail, setDocumentDetail] = useState<VerificationSubmissionDetail | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [recentOrderFilter, setRecentOrderFilter] = useState<RecentOrderFilter>("all");
  const [recentOrdersFilterOpen, setRecentOrdersFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const recentOrdersFilterRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const canReadVerificationQueue = can("verification_queue", "read");
  const canUpdateVerificationQueue = can("verification_queue", "update");
  const canReadOrders = can("orders", "read");

  function closeDocuments() {
    setDocumentsId(null);
    setDocumentDetail(null);
    setDocumentsError(null);
    setDocumentsLoading(false);
  }

  function openDocuments(id: string) {
    setDocumentDetail(null);
    setDocumentsError(null);
    setDocumentsLoading(true);
    setDocumentsId(id);
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getDashboardOverview(),
      canReadVerificationQueue ? getVerificationSubmissions({ page: 1, limit: 8 }) : Promise.resolve(null),
      canReadOrders ? getOrders({ page: 1, limit: 8 }) : Promise.resolve(null),
      getAdminActivity({ scope: "all", page: 1, limit: 5 }).catch(() => null),
    ])
      .then(([overviewPayload, verificationPayload, ordersPayload, activityPayload]) => {
        if (cancelled) {
          return;
        }

        setOverview(overviewPayload.data);
        setQueue(verificationPayload?.data ?? []);
        setRecentOrdersData(ordersPayload?.data ?? []);
        setRecentActivityRows(activityPayload?.data ?? []);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Dashboard data could not be loaded."));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadOrders, canReadVerificationQueue, refreshKey]);

  useEffect(() => {
    if (!documentsId) {
      return;
    }

    let cancelled = false;

    getVerificationSubmission(documentsId)
      .then((payload) => {
        if (!cancelled) {
          setDocumentDetail(payload.data);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setDocumentsError(getErrorMessage(loadError, "Verification documents could not be loaded."));
          setDocumentDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentsId]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!recentOrdersFilterRef.current?.contains(event.target as Node)) {
        setRecentOrdersFilterOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setRecentOrdersFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredQueue = useMemo(
    () => queue.filter((item) => `${item.user_name} ${item.user_email}`.toLowerCase().includes(deferredSearch.toLowerCase())),
    [deferredSearch, queue],
  );

  const recentOrders = useMemo(() => {
    if (recentOrderFilter === "all") {
      return recentOrdersData;
    }

    return recentOrdersData.filter((order) => order.status.toLowerCase() === recentOrderFilter);
  }, [recentOrderFilter, recentOrdersData]);

  const activeDocumentsSubmission = queue.find((item) => item.id === documentsId) ?? null;
  const activeApprovalSubmission = queue.find((item) => item.id === approveId) ?? null;
  const chart = overview?.ui.revenueByPeriod?.[period] ?? revenueSeries[period];
  const recentActivities = recentActivityRows.map(normalizeAdminActivity);

  const primaryMetrics = useMemo(
    () =>
      overview?.ui.primaryMetrics?.length
        ? overview.ui.primaryMetrics.map((metric) => ({
            title: metric.title,
            value: metric.value,
            subtitle: metric.subtitle,
            icon: normalizeMetricIcon(metric.icon, "wallet"),
            spark: metric.spark.length ? metric.spark : [12, 18, 26, 34, 42, 50],
          }))
        : [
            {
              title: "Total Revenue",
              value: formatCurrencyLabel(overview?.revenue.total ?? 0),
              subtitle: "completed payments",
              icon: "wallet" as const,
              spark: [18, 28, 40, 64, 36, 30],
            },
            {
              title: "Total Orders",
              value: (overview?.orders.total ?? 0).toLocaleString(),
              subtitle: "all statuses",
              icon: "orders" as const,
              spark: [20, 42, 48, 60, 40, 34],
            },
            {
              title: "Quote Requests",
              value: (overview?.quoteRequests.total ?? 0).toLocaleString(),
              subtitle: "new enquiries",
              icon: "sales" as const,
              spark: [14, 18, 26, 62, 30, 18],
            },
          ],
    [overview],
  );

  const secondaryMetrics = useMemo(
    () =>
      overview?.ui.secondaryMetrics?.length
        ? overview.ui.secondaryMetrics.map((metric) => ({
            title: metric.title,
            value: metric.value,
            subtitle: metric.subtitle,
            period: normalizeMetricPeriod(metric.period),
            icon: normalizeMetricIcon(metric.icon, "verification"),
            spark: metric.spark.length ? metric.spark : [12, 16, 20, 24, 28, 32],
          }))
        : [
            {
              title: "Bundle Requests",
              value: (overview?.bundleRequests.pending ?? 0).toLocaleString(),
              period: "monthly" as const,
              icon: "bundles" as const,
              spark: [14, 18, 24, 30, 38, 42],
            },
            {
              title: "Open Jobs",
              value: (overview?.jobs.open ?? 0).toLocaleString(),
              period: "monthly" as const,
              icon: "installers" as const,
              spark: [54, 52, 48, 40, 30, 24],
            },
            {
              title: "Transactions",
              value: (overview?.transactions.total ?? 0).toLocaleString(),
              period: "monthly" as const,
              icon: "wallet" as const,
              spark: [10, 18, 26, 34, 26, 18],
            },
            {
              title: "Installer Verifications",
              value: (overview?.installerVerifications.pending ?? 0).toLocaleString(),
              subtitle: "pending review",
              icon: "verification" as const,
              spark: [8, 16, 18, 22, 20, 26],
            },
          ],
    [overview],
  );

  async function handleApprove() {
    if (!activeApprovalSubmission) {
      return;
    }

    try {
      await approveVerification(activeApprovalSubmission.id, { admin_note: "" });
      setApproveId(null);
      setRefreshKey((value) => value + 1);
    } catch (approveError) {
      setError(getErrorMessage(approveError, "The verification submission could not be approved."));
    }
  }

  return (
    <>
      <div className="dashboard-stack">
        <ErrorMessage title="Dashboard load failed" message={error} />

        <section className="stats-grid">
          {primaryMetrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </section>

        <section className="stats-grid--four">
          {secondaryMetrics.map((metric) => (
            <MetricCardSecondary key={metric.title} {...metric} compact />
          ))}
        </section>

        <section className="dashboard-split">
          <Panel className="overflow-hidden">
            <PanelHeader
              title="Revenue Over Time"
              action={
                <div className="tabs-strip is-compact">
                  {periodOptions.map((item) => (
                    <button key={item.value} type="button" className={`tabs-strip__button ${period === item.value ? "is-active" : ""}`} onClick={() => setPeriod(item.value)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="px-6 pb-6 pt-4">
              <RevenueChart {...chart} />
            </div>
          </Panel>

          {canReadVerificationQueue ? (
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Installer Verification Queue"
                description={`${overview?.installerVerifications.pending ?? queue.length} installers awaiting verification`}
                action={
                  <Link href="/dashboard/verification-queue" className="text-sm font-semibold text-[var(--text-soft)] underline-offset-4 hover:underline">
                    See All
                  </Link>
                }
              />
              <div className="px-6 pt-4">
                <SearchField value={search} onChange={setSearch} placeholder="Search vendors..." />
              </div>
              <div className="px-6 pb-4 pt-2">
                {filteredQueue.length ? (
                  filteredQueue.slice(0, 4).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 border-b border-[var(--border)] py-4 last:border-b-0">
                      <Avatar alt={item.user_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold sm:text-[15px]">{item.user_name}</p>
                        <p className="truncate text-sm text-[var(--text-soft)]">{item.user_email}</p>
                      </div>
                      <IconButton label={`View ${item.user_name}`} icon={<EyeIcon className="menu-icon" />} onClick={() => openDocuments(item.id)} />
                      {item.status.toLowerCase() === "pending" && canUpdateVerificationQueue ? (
                        <Button variant="primary" size="sm" onClick={() => setApproveId(item.id)}>
                          Approve
                        </Button>
                      ) : (
                        <StatusPill label={formatEnumLabel(item.status)} tone={toneFromStatus(item.status)} />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading verification queue..." : "No verification submissions matched the search."}</p>
                )}
              </div>
            </Panel>
          ) : null}
        </section>

        <section className="dashboard-split dashboard-split--activity-orders">
          <Panel className="overflow-hidden">
            <PanelHeader title="Recent Activity" action={<Link href="/activity-history" className="text-sm font-semibold text-[var(--text-soft)] underline-offset-4 hover:underline">See All</Link>} />
            <div className="px-6 pb-4">
              {recentActivities.length ? (
                recentActivities.map((activity) => (
                  <article key={activity.id} className="border-b border-[var(--border)] py-4 last:border-b-0">
                    <ActivityListItem title={activity.title} description={activity.description} meta={activity.meta} tone={activity.tone} />
                  </article>
                ))
              ) : (
                <p className="py-4 text-sm text-[var(--text-soft)]">{isLoading ? "Loading recent activity..." : "No recent activity was returned by the activity log."}</p>
              )}
            </div>
          </Panel>

          {canReadOrders ? (
            <Panel className="overflow-hidden">
              <PanelHeader
                title="Recent Orders"
                action={
                  <div className="inline-actions">
                    <div className="menu-anchor" ref={recentOrdersFilterRef}>
                      <Button
                        variant="secondary"
                        size="sm"
                        leadingIcon={<FilterIcon className="mini-icon" />}
                        trailingIcon={<ChevronDownIcon className="mini-icon" />}
                        onClick={() => setRecentOrdersFilterOpen((value) => !value)}
                      >
                        {recentOrderFilter === "all" ? "Filter" : formatEnumLabel(recentOrderFilter)}
                      </Button>
                      {recentOrdersFilterOpen ? (
                        <div className="menu-panel is-compact-menu">
                          <button
                            type="button"
                            className={cx("menu-item", recentOrderFilter === "all" && "is-active")}
                            onClick={() => {
                              setRecentOrderFilter("all");
                              setRecentOrdersFilterOpen(false);
                            }}
                          >
                            <span>All statuses</span>
                          </button>
                          {recentOrderStatusOptions.map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={cx("menu-item", recentOrderFilter === status && "is-active")}
                              onClick={() => {
                                setRecentOrderFilter(status);
                                setRecentOrdersFilterOpen(false);
                              }}
                            >
                              <span>{formatEnumLabel(status)}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <Link href="/orders" className="text-sm font-semibold text-[var(--text-soft)] underline-offset-4 hover:underline">
                      See All
                    </Link>
                  </div>
                }
              />
              <div className="table-scroll">
                <table className="dashboard-table min-w-0">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length ? (
                      recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>{order.customer_name}</td>
                          <td>{formatDateTimeLabel(order.created_at)}</td>
                          <td>
                            <StatusPill label={formatEnumLabel(order.status)} tone={toneFromStatus(order.status)} />
                          </td>
                          <td>{formatCurrencyLabel(order.total_amount, order.currency)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="cell-subtle">
                          {isLoading ? "Loading recent orders..." : "No recent orders found for this status."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </section>
      </div>

      <VerificationDocumentsDialog
        open={Boolean(documentsId)}
        submissionName={activeDocumentsSubmission?.user_name}
        documents={documentDetail?.documents ?? []}
        isLoading={documentsLoading}
        error={documentsError}
        onClose={closeDocuments}
      />

      <ApproveVerificationDialog
        open={Boolean(activeApprovalSubmission)}
        canViewDocuments={Boolean(activeApprovalSubmission)}
        title="Approve Verification?"
        description="It is recommended to view the documents before approving any verification."
        onClose={() => setApproveId(null)}
        onViewDocuments={
          activeApprovalSubmission
            ? () => {
                setApproveId(null);
                openDocuments(activeApprovalSubmission.id);
              }
            : undefined
        }
        onConfirm={handleApprove}
      />
    </>
  );
}
