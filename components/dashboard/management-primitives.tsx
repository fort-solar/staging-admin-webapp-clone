"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, SearchField, cx } from "@/components/dashboard/ui";
import { ChevronLeftIcon, EyeIcon } from "@/components/dashboard/icons";

export function ManagementBackLink({
  href,
  label,
  meta,
}: {
  href: string;
  label: string;
  meta?: string;
}) {
  return (
    <div className="management-back-row">
      <Link href={href} className="management-back-link">
        <ChevronLeftIcon className="mini-icon" />
        <span>{label}</span>
      </Link>
      {meta ? <span className="management-back-meta">{meta}</span> : null}
    </div>
  );
}

export function ActionLink({
  href,
  children,
  variant = "primary",
  size = "sm",
  leadingIcon,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  leadingIcon?: ReactNode;
}) {
  return (
    <Link href={href} className={cx("action-button", `is-${variant}`, `is-${size}`)}>
      {leadingIcon}
      <span>{children}</span>
    </Link>
  );
}

export function DirectoryToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  action,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filters?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="management-toolbar">
      <div className="management-toolbar__search">
        <SearchField value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
      </div>
      <div className="management-toolbar__actions">
        {filters}
        {action}
      </div>
    </div>
  );
}

export function CatalogCard({
  href,
  image,
  title,
  eyebrow,
  price,
  summary,
  status,
  stats,
  actions,
}: {
  href: string;
  image: string;
  title: string;
  eyebrow: string;
  price: string;
  summary: string;
  status?: ReactNode;
  stats: Array<{ label: string; value: string; progress: number }>;
  actions?: ReactNode;
}) {
  return (
    <article className="catalog-card">
      <div className="catalog-card__header">
        <Link href={href} className="catalog-card__hero" aria-label={`Open ${title}`}>
          <span className="catalog-card__media">
            <Image src={image} alt={title} fill sizes="96px" />
          </span>
          <div className="catalog-card__copy">
            <div className="catalog-card__title-row">
              <h3>{title}</h3>
              {actions}
            </div>
            <p className="catalog-card__eyebrow">{eyebrow}</p>
            <strong className="catalog-card__price">{price}</strong>
          </div>
        </Link>
      </div>
      <div className="catalog-card__body">
        <div className="catalog-card__summary-row">
          <p>{summary}</p>
          {status}
        </div>
        <div className="catalog-card__stats">
          {stats.map((stat) => (
            <StatMeter key={stat.label} label={stat.label} value={stat.value} progress={stat.progress} />
          ))}
        </div>
      </div>
    </article>
  );
}

export function StatMeter({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div className="catalog-stat">
      <div className="catalog-stat__row">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="catalog-stat__track">
        <span style={{ width: `${Math.max(8, Math.min(progress, 100))}%` }} />
      </div>
    </div>
  );
}

export function DetailPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("detail-panel", className)}>
      <div className="detail-panel__header">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="detail-panel__body">{children}</div>
    </section>
  );
}

export function KeyValueList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; valueClassName?: string }>;
}) {
  return (
    <div className="detail-key-list">
      {items.map((item) => (
        <div key={item.label} className="detail-key-list__row">
          <span>{item.label}</span>
          <strong className={item.valueClassName}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function MediaShowcase({
  title,
  image,
  gallery,
}: {
  title: string;
  image: string;
  gallery: string[];
}) {
  return (
    <div className="media-showcase">
      <div className="media-showcase__main">
        <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, 480px" />
      </div>
      <div className="media-showcase__thumbs">
        {gallery.map((asset, index) => (
          <span key={`${asset}-${index}`} className="media-showcase__thumb">
            <Image src={asset} alt={`${title} preview ${index + 1}`} fill sizes="90px" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function AttachmentItem({
  label,
  helper,
  actionLabel = "Preview",
}: {
  label: string;
  helper?: string;
  actionLabel?: string;
}) {
  return (
    <div className="attachment-item">
      <div className="attachment-item__copy">
        <strong>{label}</strong>
        {helper ? <span>{helper}</span> : null}
      </div>
      <Button variant="secondary" size="sm" leadingIcon={<EyeIcon className="mini-icon" />}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function TagList({ items }: { items: string[] }) {
  return (
    <div className="tag-list">
      {items.map((item) => (
        <span key={item} className="tag-list__item">
          {item}
        </span>
      ))}
    </div>
  );
}

export function InlineCallout({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "warning";
}) {
  return <div className={cx("inline-callout", tone === "warning" && "is-warning")}>{children}</div>;
}

export function WizardProgress({
  step,
  total = 3,
}: {
  step: number;
  total?: number;
}) {
  return (
    <div className="wizard-progress" aria-hidden="true">
      {Array.from({ length: total }).map((_, index) => (
        <span key={index} className={cx(index < step && "is-active")} />
      ))}
    </div>
  );
}
