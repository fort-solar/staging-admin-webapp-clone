"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { getOrder, orderSummaryItems, orderTimeline, toneFromOrderStatus, mapPreview } from "@/lib/dashboard-data";
import { MapCard, MetricCardSecondary, Panel, SelectField, StatusPill, TimelineStep } from "@/components/dashboard/ui";
import { ChevronLeftIcon } from "@/components/dashboard/icons";

const timelineStatuses = ["Processing", "Order Packed", "Shipped", "In Transit", "Delivered"];

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = getOrder(id);
  const [status, setStatus] = useState(order.id === "ORD192001" ? "In Transit" : order.status);

  const currentIndex = useMemo(() => timelineStatuses.indexOf(status), [status]);

  return (
    <div className="dashboard-stack">
      <section className="stats-grid--three">
        <MetricCardSecondary title="Total Orders" value="1,262" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="orders" spark={[20, 36, 48, 62, 42, 28]} />
        <MetricCardSecondary title="Completed Orders" value="960" delta="+10.4%" deltaTone="success" subtitle="from last month" icon="verification" spark={[16, 24, 32, 44, 54, 62]} />
        <MetricCardSecondary title="Pending Orders" value="262" delta="-0.4%" deltaTone="warning" subtitle="from last month" icon="bundles" spark={[42, 38, 28, 22, 18, 12]} />
      </section>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6">
          <div className="inline-actions">
            <Link href="/orders" className="icon-button" aria-label="Back to orders">
              <ChevronLeftIcon className="menu-icon" />
            </Link>
            <h2 className="m-0 text-lg font-extrabold sm:text-[20px]">#{order.id}</h2>
          </div>
          <div className="inline-actions">
            <StatusPill label={status} tone={toneFromOrderStatus(status)} />
            <SelectField value={status} onChange={setStatus} options={["Processing", "Order Packed", "Shipped", "In Transit", "Delivered", "Cancelled"]} />
          </div>
        </div>

        <Panel className="mx-6 mb-6 border border-[var(--border)] shadow-none">
          <div className="grid gap-0 xl:grid-cols-3">
            <div className="border-b border-[var(--border)] p-6 xl:border-b-0 xl:border-r">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Order Information</h3>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4"><span className="text-[var(--text-soft)]">Order Id:</span><strong>{order.id}</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[var(--text-soft)]">Order Date:</span><strong>Apr 9, 2023</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[var(--text-soft)]">Tracking Id:</span><strong>NG2345UKX21</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[var(--text-soft)]">Courier:</span><strong>GIG Logistics</strong></div>
                <div className="flex justify-between gap-4"><span className="text-[var(--text-soft)]">Estimated Delivery:</span><strong>Apr 12, 2023</strong></div>
              </div>
              <div className="mt-6 border-t border-[var(--border)] pt-6">
                <h4 className="m-0 text-sm font-bold sm:text-[15px]">Shipping Address</h4>
                <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--text-soft)]">
                  <div className="flex justify-between gap-4"><span>Name:</span><strong className="text-[var(--text)]">Nessie Smith</strong></div>
                  <div className="flex justify-between gap-4"><span>Address:</span><strong className="max-w-[170px] text-right text-[var(--text)]">123 Main Street Apt 4B New York, NY 10001 United States</strong></div>
                  <div className="flex justify-between gap-4"><span>Phone Number:</span><strong className="text-[var(--text)]">+1 (555) 123-4567</strong></div>
                </div>
              </div>
              <div className="mt-6">
                <MapCard title="Delivery Location" addressLines={["Rivers State"]} image={mapPreview} />
              </div>
            </div>

            <div className="border-b border-[var(--border)] p-6 xl:border-b-0 xl:border-r">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Tracking Timeline</h3>
              <div className="mt-5 flex flex-col">
                {orderTimeline.map((step, index) => (
                  <TimelineStep key={step.id} index={index} title={step.title} date={step.date} description={step.description} completed={currentIndex >= index && status !== "Cancelled"} />
                ))}
              </div>
            </div>

            <div className="p-6">
              <h3 className="m-0 text-sm font-bold sm:text-[15px]">Order Summary</h3>
              <div className="mt-5 flex items-center justify-between">
                <strong className="text-sm sm:text-[15px]">3 Items</strong>
                <span className="text-[var(--text-soft)]">₦320,000.00</span>
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {orderSummaryItems.map((item) => (
                  <div key={item.title} className="product-cell justify-between">
                    <div className="product-cell">
                      <span className="product-thumb" aria-hidden="true" />
                      <div className="product-cell__text">
                        <strong>{item.title}</strong>
                      </div>
                    </div>
                    <span className="cell-subtle">{item.amount}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-4 border-t border-[var(--border)] pt-6 text-sm">
                <div className="flex justify-between"><span>Service Fee</span><strong>₦32,060.00</strong></div>
                <div className="flex justify-between"><span>Shipping Fee</span><strong>₦3,860.00</strong></div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-6">
                <strong className="text-base sm:text-[18px]">Total</strong>
                <strong className="text-lg sm:text-[20px]">₦320,000.00</strong>
              </div>
            </div>
          </div>
        </Panel>
      </Panel>
    </div>
  );
}
