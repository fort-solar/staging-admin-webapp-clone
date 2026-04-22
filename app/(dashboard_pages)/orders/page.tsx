"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { orderRows } from "@/lib/dashboard-data";
import { Checkbox, IconButton, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill } from "@/components/dashboard/ui";
import { EyeIcon } from "@/components/dashboard/icons";

export default function OrdersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const filteredRows = useMemo(
    () =>
      orderRows.filter((order) => {
        const matchesQuery = `${order.id} ${order.product} ${order.customer}`.toLowerCase().includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || order.status === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, status],
  );

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary title="Total Orders" value="1,262" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="orders" spark={[20, 36, 48, 62, 42, 28]} />
        <MetricCardSecondary title="Completed Orders" value="960" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="verification" spark={[16, 24, 32, 44, 54, 62]} />
        <MetricCardSecondary title="Pending Orders" value="262" delta="-0.4%" deltaTone="warning" subtitle="from last month" icon="bundles" spark={[42, 38, 28, 22, 18, 12]} />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Order List" />
        <div className="dashboard-table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search order report..." />
          <div className="inline-actions">
            <SelectField value={status} onChange={setStatus} options={["All", ...Array.from(new Set(orderRows.map((row) => row.status)))]} />
          </div>
        </div>
        <div className="table-scroll pt-2">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th className="table-checkbox-cell">
                  <Checkbox />
                </th>
                <th>Order Id</th>
                <th>Products</th>
                <th>Tracking Id</th>
                <th>Date</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((order) => (
                <tr key={order.id}>
                  <td className="table-checkbox-cell">
                    <Checkbox />
                  </td>
                  <td>{order.id}</td>
                  <td>
                    <div className="product-cell flex">
                      <span className="product-thumb" aria-hidden="true" />
                      <div className="product-cell__text flex-col flex">
                        <strong>{order.product}</strong>
                        <span>{order.extraItems}</span>
                      </div>
                    </div>
                  </td>
                  <td>{order.trackingId}</td>
                  <td>{order.date}</td>
                  <td>{order.amount}</td>
                  <td>
                    <StatusPill label={order.status} tone={order.statusTone} />
                  </td>
                  <td className="text-right">
                    <Link href={`/orders/${order.id}`} className="inline-flex">
                      <IconButton label={`View ${order.id}`} icon={<EyeIcon className="menu-icon" />} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={24} onChange={setPage} />
      </Panel>
    </div>
  );
}
