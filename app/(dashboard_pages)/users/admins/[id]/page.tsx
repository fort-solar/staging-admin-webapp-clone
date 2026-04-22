"use client";

import { use, useState } from "react";
import Link from "next/link";
import { adminActivityFeed, adminPermissions, getAdmin, toneFromStatus } from "@/lib/dashboard-data";
import {
  ActivityListItem,
  Avatar,
  Button,
  InfoIcons,
  InfoRow,
  InfoStat,
  Panel,
  StatusPill,
  TableActionsMenu,
  Tabs,
} from "@/components/dashboard/ui";
import { ChevronLeftIcon, KeyIcon, MessageIcon, ShieldOffIcon } from "@/components/dashboard/icons";

const tabs = ["Activity Log (1245)", "Permissions"] as const;

export default function AdminDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const admin = getAdmin(id);
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);

  return (
    <Panel className="overflow-hidden">
      <div className="detail-hero">
        <div className="detail-hero__identity">
          <Link href="/users/admins" className="icon-button" aria-label="Back to admins">
            <ChevronLeftIcon className="menu-icon" />
          </Link>
          <Avatar src={admin.avatar} alt={admin.name} size="xl" />
          <div className="detail-hero__meta">
            <div className="inline-actions">
              <h2>{admin.name}</h2>
              <StatusPill label={admin.status} tone={admin.statusTone} />
            </div>
            <p>Joined January 12, 2023 • Last online Apr 1st, 2024 at 12:30pm</p>
          </div>
        </div>
        <div className="detail-hero__actions">
          <TableActionsMenu
            panelClassName="is-admin-menu"
            items={[
              { label: "Reset Password", icon: <KeyIcon className="menu-icon" /> },
              { label: "Suspend Admin", tone: "danger", icon: <ShieldOffIcon className="menu-icon" /> },
            ]}
          />
          <Button variant="secondary" leadingIcon={<MessageIcon className="mini-icon" />}>
            Contact Admin
          </Button>
        </div>
      </div>

      <div className="detail-layout px-6 py-6">
        <Panel className="border border-[var(--border)] shadow-none">
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs value={tab} onChange={setTab} options={tabs} />
              <Button variant="secondary" size="sm" leadingIcon={InfoIcons.filter}>
                Filter
              </Button>
            </div>

            {tab === "Activity Log (1245)" ? (
              <div className="mt-6 flex flex-col">
                {adminActivityFeed.map((item) => (
                  <ActivityListItem key={item.id} title={item.title} description={item.description} meta={item.meta} tone={item.tone} />
                ))}
              </div>
            ) : (
              <div className="table-scroll px-0 pt-6">
                <table className="dashboard-table min-w-0">
                  <thead>
                    <tr>
                      <th className="table-checkbox-cell"> </th>
                      <th>Module</th>
                      <th>Access Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPermissions.map((permission) => (
                      <tr key={permission.module}>
                        <td className="table-checkbox-cell">
                          <div className="checkbox"><span /></div>
                        </td>
                        <td>{permission.module}</td>
                        <td>{permission.accessLevel}</td>
                        <td>
                          <StatusPill label={permission.status} tone={toneFromStatus(permission.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <h3 className="m-0 text-[15px] font-bold">Admin Information</h3>
          <div className="mt-3">
            <InfoRow icon={InfoIcons.phone} label="Phone Number" value={admin.phone} />
            <InfoRow icon={InfoIcons.mail} label="Email" value={admin.email} />
          </div>

          <div className="mt-8">
            <h3 className="m-0 text-[15px] font-bold">Account Statistics</h3>
            <div className="mt-4 flex flex-col gap-4">
              <InfoStat label="Account Age" value="449 days" progress={88} />
              <InfoStat label="Activity Level" value="High" progress={100} />
              <InfoStat label="Last Activity" value="3 hours ago" progress={85} />
            </div>
          </div>
        </Panel>
      </div>
    </Panel>
  );
}
