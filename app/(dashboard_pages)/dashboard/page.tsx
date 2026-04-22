"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  dashboardPrimaryMetrics,
  dashboardRecentActivities,
  dashboardSecondaryMetrics,
  orderRows,
  revenueSeries,
  type ChartPeriod,
  toneFromStatus,
  verificationRows,
} from "@/lib/dashboard-data";
import { Avatar, Button, IconButton, MetricCard, MetricCardSecondary, Panel, PanelHeader, RevenueChart, SearchField, StatusPill, cx } from "@/components/dashboard/ui";
import { ChevronDownIcon, EyeIcon, FilterIcon } from "@/components/dashboard/icons";
import { ApproveVerificationDialog, VerificationDocumentsDialog } from "@/components/dashboard/verification-dialogs";

const periodOptions = [
  { value: "all" as const, label: "All" },
  { value: "yearly" as const, label: "Yearly" },
  { value: "monthly" as const, label: "Monthly" },
  { value: "weekly" as const, label: "Weekly" },
];

const recentOrderStatusOptions = ["Cancelled", "Order Packed", "Processing", "Delivered", "In Transit"] as const;

type RecentOrderStatus = (typeof recentOrderStatusOptions)[number];
type RecentOrderFilter = "all" | RecentOrderStatus;

export default function DashboardPage() {
  const [period, setPeriod] = useState<ChartPeriod>("all");
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState(verificationRows);
  const [documentsId, setDocumentsId] = useState<string | null>(null);
  const [approveId, setApproveId] = useState<string | null>(null);
  const [recentOrderFilter, setRecentOrderFilter] = useState<RecentOrderFilter>("all");
  const [recentOrdersFilterOpen, setRecentOrdersFilterOpen] = useState(false);
  const recentOrdersFilterRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search);

  const filteredQueue = useMemo(
    () =>
      queue.filter((item) =>
        `${item.name} ${item.email}`.toLowerCase().includes(deferredSearch.toLowerCase()),
      ),
    [deferredSearch, queue],
  );

  const recentOrders = useMemo(() => {
    const dashboardOrders = orderRows.filter((order) =>
      recentOrderStatusOptions.includes(order.status as RecentOrderStatus),
    );

    if (recentOrderFilter === "all") {
      return dashboardOrders;
    }

    return dashboardOrders.filter((order) => order.status === recentOrderFilter);
  }, [recentOrderFilter]);

  const activeDocumentsSubmission = queue.find((item) => item.id === documentsId) ?? null;
  const activeApprovalSubmission = queue.find((item) => item.id === approveId) ?? null;

  const chart = revenueSeries[period];

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

  return (
    <>
      <div className="dashboard-stack">
      <section className="stats-grid">
        {dashboardPrimaryMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </section>

      <section className="stats-grid--four">
        {dashboardSecondaryMetrics.map((metric) => (
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
                  <button
                    key={item.value}
                    type="button"
                    className={`tabs-strip__button ${period === item.value ? "is-active" : ""}`}
                    onClick={() => setPeriod(item.value)}
                  >
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

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Installer Verification Queue"
            description="8 installers awaiting verification"
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
            {filteredQueue.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center gap-3 border-b border-[var(--border)] py-4 last:border-b-0">
                <Avatar src={item.avatar} alt={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{item.name}</p>
                  <p className="truncate text-sm text-[var(--text-soft)]">{item.email}</p>
                </div>
                <IconButton
                  label={`View ${item.name}`}
                  icon={<EyeIcon className="menu-icon" />}
                  onClick={() => setDocumentsId(item.id)}
                />
                {item.status === "Pending" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setApproveId(item.id)}
                  >
                    Approve
                  </Button>
                ) : (
                  <StatusPill label={item.status} tone={item.tone} />
                )}
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="dashboard-split" style={{ gridTemplateColumns: "minmax(280px,0.9fr) minmax(0,1.55fr)" }}>
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Recent Activity"
            action={<button className="text-sm font-semibold text-[var(--text-soft)] underline-offset-4 hover:underline">See All</button>}
          />
          <div className="px-6 pb-4">
            {dashboardRecentActivities.map((activity) => (
              <article key={activity.id} className="border-b border-[var(--border)] py-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <span className={`activity-item__glyph is-${activity.tone}`}>
                    <FilterIcon className="activity-item__icon" />
                  </span>
                  <div className="flex-1">
                    <h3 className="m-0 text-[15px] font-bold">{activity.title}</h3>
                    <p className="m-0 pt-1 text-sm text-[var(--text-soft)]">{activity.description}</p>
                    <small className="text-[12px] text-[var(--text-faint)]">{activity.meta}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Panel>

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
                    {recentOrderFilter === "all" ? "Filter" : recentOrderFilter}
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
                          <span>{status}</span>
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
                  <th>Transaction Id</th>
                  <th>Products</th>
                  <th>Transaction Date</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length ? (
                  recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.product}</td>
                      <td>{order.date}</td>
                      <td>
                        <StatusPill label={order.status} tone={order.statusTone} />
                      </td>
                      <td>{order.amount.replace("₦", "$")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="cell-subtle">
                      No recent orders found for this status.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
      </div>
      <VerificationDocumentsDialog
        open={Boolean(activeDocumentsSubmission)}
        submission={activeDocumentsSubmission}
        onClose={() => setDocumentsId(null)}
      />
      <ApproveVerificationDialog
        open={Boolean(activeApprovalSubmission)}
        submission={activeApprovalSubmission}
        title="Approve Verification?"
        description="It is recommended to view the documents before approving any verification."
        onClose={() => setApproveId(null)}
        onViewDocuments={
          activeApprovalSubmission
            ? () => {
                setApproveId(null);
                setDocumentsId(activeApprovalSubmission.id);
              }
            : undefined
        }
        onConfirm={() => {
          if (!activeApprovalSubmission) {
            return;
          }

          setQueue((current) =>
            current.map((row) =>
              row.id === activeApprovalSubmission.id
                ? { ...row, status: "Approved", tone: toneFromStatus("Approved"), adminNote: undefined }
                : row,
            ),
          );
          setApproveId(null);
        }}
      />
    </>
  );
}
