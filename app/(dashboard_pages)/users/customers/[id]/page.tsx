"use client";

import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  customerActivityFeed,
  customerPurchases,
  customerRatingBreakdown,
  customerReviews,
  customerWishlist,
  getCustomer,
  mapPreview,
  toneFromStatus,
} from "@/lib/dashboard-data";
import {
  ActivityListItem,
  Avatar,
  Button,
  InfoIcons,
  InfoRow,
  MapCard,
  Panel,
  RatingBreakdown,
  RatingStars,
  ReviewCard,
  SelectField,
  StatusPill,
  TableActionsMenu,
  Tabs,
} from "@/components/dashboard/ui";
import { ChevronLeftIcon, MessageIcon } from "@/components/dashboard/icons";

const tabs = ["Purchase History (23)", "Wishlist", "Reviews (23)", "Activity"] as const;
const orderStatusOptions = ["Processing", "Order Packed", "Shipped", "In Transit", "Delivered", "Cancelled"] as const;

export default function CustomerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const customer = getCustomer(id);
  const [tab, setTab] = useState<(typeof tabs)[number]>(tabs[0]);
  const [purchases, setPurchases] = useState(customerPurchases);

  return (
    <Panel className="overflow-hidden">
      <div className="detail-hero">
        <div className="detail-hero__identity">
          <Link href="/users/customers" className="icon-button" aria-label="Back to customers">
            <ChevronLeftIcon className="menu-icon" />
          </Link>
          <Avatar src={customer.avatar} alt={customer.name} size="xl" />
          <div className="detail-hero__meta">
            <div className="inline-actions">
              <h2>{customer.name}</h2>
              <StatusPill label={customer.status} tone={customer.statusTone} className="min-h-7.5!" />
            </div>
            <p>
              {customer.id} • Joined March 17 2024 • Last online Sept, 17 2024 at 1:27pm
            </p>
          </div>
        </div>
        <div className="detail-hero__actions">
          <TableActionsMenu items={[{ label: "Block buyer", tone: "danger" }]} />
          <Button variant="secondary" leadingIcon={<MessageIcon className="mini-icon" />}>
            Contact Buyer
          </Button>
        </div>
      </div>

      <div className="detail-layout px-6 py-6">
        <Panel className="border border-(--border) shadow-none">
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs value={tab} onChange={setTab} options={tabs} />
              {tab === "Activity" ? (
                <Button variant="secondary" size="sm" leadingIcon={InfoIcons.sort}>
                  Sort
                </Button>
              ) : tab === "Reviews (23)" ? (
                <div className="inline-actions">
                  <Button variant="secondary" size="sm" leadingIcon={InfoIcons.filter}>
                    Filter
                  </Button>
                  <Button variant="secondary" size="sm" leadingIcon={InfoIcons.sort}>
                    Sort
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" leadingIcon={InfoIcons.filter}>
                  Filter
                </Button>
              )}
            </div>

            {tab === "Purchase History (23)" ? (
              <div className="mt-6 flex flex-col gap-4">
                {purchases.map((purchase) => (
                  <article key={purchase.id} className="purchase-history-card">
                    <div className="purchase-history-card__body">
                      <div className="purchase-history-card__content">
                        <StatusPill label={purchase.id} tone="neutral" solid={false} />
                        <div className="product-cell mt-4">
                          <span className="product-thumb">
                            <Image src={purchase.image} alt={purchase.product} fill sizes="40px" />
                          </span>
                          <div className="flex gap-2"><div className="aspect-4/3 w-30 bg-zinc-200 rounded-2xl" /> <div className="product-cell__text">

                            <strong>{purchase.product} <span>{purchase.extraItems}</span></strong>
                            
                            <span>Order Date: {purchase.orderDate}</span>
                            <strong>
                              {purchase.amount} <span >•  {purchase.payment}</span>
                            </strong>
                          </div></div>

                        </div>
                        <div className="purchase-history-card__footer">
                          <p className="purchase-history-card__delivery">
                            Estimated Delivery Date: <strong>{purchase.delivery}</strong>
                          </p>
                          <div className="purchase-history-card__status" data-tone={toneFromStatus(purchase.status)}>
                            <span className="purchase-history-card__status-label">Order Status</span>
                            <SelectField
                              value={purchase.status}
                              onChange={(nextStatus) =>
                                setPurchases((current) =>
                                  current.map((item) =>
                                    item.id === purchase.id
                                      ? {
                                          ...item,
                                          status: nextStatus,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              options={[...orderStatusOptions]}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "Wishlist" ? (
              <div className="mt-6 grid gap-4">
                {customerWishlist.map((item) => (
                  <article key={item.id} className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="relative overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface-soft)]">
                      <Image src={item.image} alt={item.title} fill sizes="320px" className="object-cover" />
                    </div>
                    <h3 className="mb-0 mt-4 text-[16px] font-bold">{item.title}</h3>
                    <p className="mb-0 mt-1 text-sm text-[var(--text-soft)]">{item.subtitle}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <strong>{item.price}</strong>
                      <Button variant="secondary" size="sm">
                        View Item
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            {tab === "Reviews (23)" ? (
              <div className="mt-6 flex flex-col gap-8">
                <div className="grid gap-8 border-b border-[var(--border)] pb-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="flex flex-col gap-2">
                    <strong className="text-[42px] font-extrabold tracking-[-0.04em]">4.8</strong>
                    <RatingStars rating={4} />
                    <span className="text-sm text-[var(--text-soft)]">92 reviews</span>
                  </div>
                  <RatingBreakdown rows={customerRatingBreakdown} />
                </div>
                <div className="flex flex-col gap-2">
                  {customerReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} showOrderMeta />
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "Activity" ? (
              <div className="mt-6 flex flex-col">
                {customerActivityFeed.map((item) => (
                  <ActivityListItem key={item.id} title={item.title} description={item.description} meta={item.meta} tone={item.tone} />
                ))}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <h3 className="m-0 text-[15px] font-bold">Customer Information</h3>
          <div className="mt-3">
            <InfoRow icon={InfoIcons.phone} label="Phone Number" value={customer.phone} />
            <InfoRow icon={InfoIcons.mail} label="Email" value={customer.email} />
          </div>

          <div className="mt-6">
            <h3 className="m-0 text-[15px] font-bold">Shipping Address</h3>
            <div className="mt-4">
              <MapCard
                title="Rivers State"
                addressLines={["123, Main Street Apt 4B", "New York, NY 10001", "United States"]}
                image={mapPreview}
              />
            </div>
          </div>

          {tab === "Activity" ? (
            <div className="mt-8">
              <h3 className="m-0 text-[15px] font-bold">Wallet Information</h3>
              <div className="mt-4 rounded-[20px] bg-[var(--brand)] px-4 py-5 text-white">
                <p className="m-0 text-[32px] font-extrabold tracking-[-0.04em]">₦7,500.00</p>
                <span className="text-sm text-white/78">Wallet balance</span>
              </div>
            </div>
          ) : null}
        </Panel>
      </div>
    </Panel>
  );
}
