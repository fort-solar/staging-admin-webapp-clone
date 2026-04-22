"use client";

import { use } from "react";
import Link from "next/link";
import {
  getInstaller,
  installerRatingBreakdown,
  installerReviews,
  installerSkills,
  mapPreview,
} from "@/lib/dashboard-data";
import {
  Avatar,
  Button,
  InfoIcons,
  InfoRow,
  MapCard,
  Panel,
  RatingBreakdown,
  RatingStars,
  ReviewCard,
  StatusPill,
  TableActionsMenu,
} from "@/components/dashboard/ui";
import { BankIcon, ChevronLeftIcon, MessageIcon, WalletIcon } from "@/components/dashboard/icons";

export default function InstallerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const installer = getInstaller(id);

  return (
    <Panel className="overflow-hidden">
      <div className="detail-hero">
        <div className="detail-hero__identity">
          <Link href="/users/installers" className="icon-button" aria-label="Back to installers">
            <ChevronLeftIcon className="menu-icon" />
          </Link>
          <Avatar src={installer.avatar} alt={installer.name} size="xl" />
          <div className="detail-hero__meta">
            <div className="inline-actions">
              <h2>{installer.name}</h2>
              <StatusPill label={installer.status} tone={installer.statusTone} />
            </div>
            <p>
              {installer.id} • Joined March 17 2024 • Last logged in Sept, 17 2024 at 1:27pm
            </p>
            <div className="stacked-actions">
              {installerSkills.map((skill) => (
                <StatusPill key={skill} label={skill} tone="neutral" solid={false} />
              ))}
            </div>
          </div>
        </div>
        <div className="detail-hero__actions">
          <TableActionsMenu items={[{ label: "View documents" }, { label: "Flag installer", tone: "danger" }]} />
          <Button variant="secondary" leadingIcon={<MessageIcon className="mini-icon" />}>
            Contact Installer
          </Button>
        </div>
      </div>

      <div className="detail-layout px-6 py-6">
        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <h3 className="m-0 text-sm font-bold sm:text-[15px]">Vendor Information</h3>
          <div className="mt-3">
            <InfoRow icon={InfoIcons.phone} label="Phone Number" value={installer.phone} />
            <InfoRow icon={InfoIcons.mail} label="Email" value={installer.email} />
            <InfoRow icon={InfoIcons.filter} label="Address" value={installer.address} />
            <InfoRow label="Documents" value={<a className="font-semibold text-[var(--brand)] underline-offset-4 hover:underline">View Documents</a>} />
          </div>

          <div className="mt-8">
            <h3 className="m-0 text-sm font-bold sm:text-[15px]">Wallet Information</h3>
            <div className="installer-wallet-card">
              <div className="installer-wallet-card__row">
                <span className="installer-wallet-card__icon">
                  <WalletIcon className="installer-wallet-card__icon-svg" />
                </span>
                <div className="installer-wallet-card__copy">
                  <p className="installer-wallet-card__value">₦7,500.00</p>
                  <span className="installer-wallet-card__label">Wallet balance</span>
                </div>
              </div>
              <div className="installer-wallet-card__divider" />
              <div className="installer-wallet-card__row">
                <span className="installer-wallet-card__icon">
                  <BankIcon className="installer-wallet-card__icon-svg" />
                </span>
                <div className="installer-wallet-card__copy">
                  <p className="installer-wallet-card__account">23411609444</p>
                  <span className="installer-wallet-card__label">Bank Name Here</span>
                </div>
                <span className="bank-pill installer-wallet-card__pill">Bank of Royale</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="m-0 text-sm font-bold sm:text-[15px]">Ratings</h3>
            <div className="mt-4 flex items-center gap-4">
              <strong className="text-3xl font-extrabold sm:text-[40px]">3.0</strong>
              <div>
                <RatingStars rating={3} />
                <p className="m-0 pt-1 text-sm text-[var(--text-soft)]">4,807 reviews</p>
              </div>
            </div>
            <div className="mt-4">
              <RatingBreakdown rows={installerRatingBreakdown} />
            </div>
          </div>

          <div className="mt-8">
            <MapCard
              title="Service Area"
              subtitle="Primary dispatch point"
              addressLines={["Rivers State", "123, Main Street Apt 4B", "New York, NY 10001"]}
              image={mapPreview}
            />
          </div>
        </Panel>

        <Panel className="border border-[var(--border)] p-6 shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="tabs-strip">
              <button type="button" className="tabs-strip__button is-active">
                Reviews (23)
              </button>
            </div>
            <div className="inline-actions">
              <Button variant="secondary" size="sm" leadingIcon={InfoIcons.filter}>
                Filter
              </Button>
              <Button variant="secondary" size="sm" leadingIcon={InfoIcons.sort}>
                Sort
              </Button>
            </div>
          </div>
          <div className="mt-6 flex max-h-[760px] flex-col overflow-auto pr-2">
            {installerReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </Panel>
      </div>
    </Panel>
  );
}
