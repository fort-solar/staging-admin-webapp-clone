"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useAccessControl } from "@/components/auth/use-access-control";
import { customerDirectory } from "@/lib/dashboard-data";
import { Checkbox, MetricCardSecondary, Pagination, Panel, PanelHeader, SearchField, SelectField, StatusPill, TableActionsMenu, Avatar } from "@/components/dashboard/ui";
import { EyeIcon, MessageIcon } from "@/components/dashboard/icons";

export default function CustomersPage() {
  const { can } = useAccessControl();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const canUpdateCustomers = can("customers", "update");

  const rows = useMemo(
    () =>
      customerDirectory.filter((customer) => {
        const matchesQuery = `${customer.id} ${customer.name} ${customer.email} ${customer.location}`
          .toLowerCase()
          .includes(deferredQuery.toLowerCase());
        const matchesStatus = status === "All" || customer.status === status;
        return matchesQuery && matchesStatus;
      }),
    [deferredQuery, status],
  );

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary title="Total Customers" value="42,739" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="customers" spark={[14, 24, 30, 42, 56, 62]} />
        <MetricCardSecondary title="Active Customers" value="30,000" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="installers" spark={[18, 22, 28, 36, 44, 52]} />
        <MetricCardSecondary title="Customers Retention" value="78.5%" delta="-0.4%" deltaTone="danger" subtitle="from last month" icon="retention" spark={[56, 52, 46, 40, 36, 30]} />
      </section>

      <Panel className="overflow-hidden">
        <PanelHeader title="Customer Directory" />
        <div className="dashboard-table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Search customers..." />
          <div className="inline-actions">
            <SelectField value={status} onChange={setStatus} options={["All", "Active", "New", "Inactive"]} />
          </div>
        </div>
        <div className="table-scroll pt-2">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th className="table-checkbox-cell">
                  <Checkbox />
                </th>
                <th>ID</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Joined</th>
                <th>Orders</th>
                <th>Spent</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td className="table-checkbox-cell">
                    <Checkbox />
                  </td>
                  <td>{customer.id}</td>
                  <td>
                    <div className="person-cell">
                      <Avatar src={customer.avatar} alt={customer.name} size="sm"/>
                      <div className="person-cell__text">
                        <strong>{customer.name}</strong>
                        <span>{customer.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>{customer.location}</td>
                  <td>{customer.joined}</td>
                  <td>{customer.orders}</td>
                  <td>{customer.spent}</td>
                  <td>
                    <StatusPill label={customer.status} tone={customer.statusTone} />
                  </td>
                  <td>
                    <div className="inline-actions justify-end">
                      <Link href={`/users/customers/${customer.id}`} className="inline-flex">
                        <button type="button" className="icon-button" aria-label={`View ${customer.name}`}>
                          <EyeIcon className="menu-icon" />
                        </button>
                      </Link>
                      <TableActionsMenu
                        panelClassName="is-customer-actions-menu"
                        items={[
                          { label: "View Details", href: `/users/customers/${customer.id}`, icon: <EyeIcon className="menu-icon" /> },
                          ...(canUpdateCustomers ? [{ label: "Contact Buyer", icon: <MessageIcon className="menu-icon" /> }] : []),
                        ]}
                      />
                    </div>
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
