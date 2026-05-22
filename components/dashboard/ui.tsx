"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { metricPeriodOptions, type MetricIconName, type MetricPeriod, type Tone } from "@/lib/dashboard-data";
import {
  ActivityIcon,
  AlertIcon,
  BarChartIcon,
  BellIcon,
  BundlesIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  DashboardIcon,
  DotsIcon,
  EyeIcon,
  FilterIcon,
  FlagIcon,
  HeartIcon,
  MailIcon,
  OrdersIcon,
  PackageIcon,
  PhoneIcon,
  ProductsIcon,
  SearchIcon,
  ShieldIcon,
  SortIcon,
  StarIcon,
  TruckIcon,
  UsersIcon,
  WalletIcon,
  XCircleIcon,
} from "@/components/dashboard/icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ActionItem = {
  label: string;
  tone?: "danger";
  href?: string;
  onSelect?: () => void;
  icon?: ReactNode;
};

type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
  form?: string;
  name?: string;
  value?: string;
  onClick?: () => void;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  disabled?: boolean;
};

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  period?: MetricPeriod;
  icon: MetricIconName;
  spark: number[];
  highlighted?: boolean;
  delta?: string;
  deltaTone?: Tone;
  compact?: boolean;
};

type RevenueChartProps = {
  labels: string[];
  values: number[];
  tooltipIndex: number;
  tooltipLabel: string;
  tooltipValue: string;
};

type PaginationProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
};

export type SelectOption = string | { label: string; value: string };

const EMPTY_SELECT_VALUE = "__fortsolar_empty_option__";

type AvatarProps = {
  src?: string;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  initials?: string;
  className?: string;
};

type TabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  compact?: boolean;
};

function SparkBars({ values }: { values: number[] }) {
  return (
    <div className="spark-bars" aria-hidden="true">
      {values.map((value, index) => (
        <span key={`${index}-${value}`} style={{ height: `${value}%` }} />
      ))}
    </div>
  );
}

function renderMetricIcon(name: MetricIconName) {
  switch (name) {
    case "wallet":
      return <WalletIcon className="metric-icon" />;
    case "sales":
      return <BarChartIcon className="metric-icon" />;
    case "orders":
      return <OrdersIcon className="metric-icon" />;
    case "products":
      return <ProductsIcon className="metric-icon" />;
    case "installers":
      return <PackageIcon className="metric-icon" />;
    case "customers":
      return <UsersIcon className="metric-icon" />;
    case "bundles":
      return <BundlesIcon className="metric-icon" />;
    case "notifications":
      return <BellIcon className="metric-icon" />;
    case "calendar":
      return <CalendarIcon className="metric-icon" />;
    case "verification":
      return <ShieldIcon className="metric-icon" />;
    case "admins":
      return <ShieldIcon className="metric-icon" />;
    case "retention":
      return <HeartIcon className="metric-icon" />;
    case "flag":
      return <FlagIcon className="metric-icon" />;
    default:
      return <DashboardIcon className="metric-icon" />;
  }
}

function classForTone(tone: Tone) {
  switch (tone) {
    case "success":
      return "is-success";
    case "warning":
      return "is-warning";
    case "danger":
      return "is-danger";
    case "info":
      return "is-info";
    case "purple":
      return "is-purple";
    default:
      return "is-neutral";
  }
}

function activityIcon(tone: Tone) {
  switch (tone) {
    case "success":
      return <CheckCircleIcon className="activity-item__icon" />;
    case "warning":
      return <ClockIcon className="activity-item__icon" />;
    case "danger":
      return <AlertIcon className="activity-item__icon" />;
    case "info":
      return <BellIcon className="activity-item__icon" />;
    case "purple":
      return <ActivityIcon className="activity-item__icon" />;
    default:
      return <ActivityIcon className="activity-item__icon" />;
  }
}

function formatMetricPeriod(period: MetricPeriod) {
  return period.charAt(0).toUpperCase() + period.slice(1);
}

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("dashboard-surface", className)}>{children}</section>;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("section-header", className)}>
      <div>
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  form,
  name,
  value,
  onClick,
  leadingIcon,
  trailingIcon,
  disabled,
}: ButtonProps) {
  return (
    <button
      type={type}
      form={form}
      name={name}
      value={value}
      className={cx("action-button", `is-${variant}`, `is-${size}`, className)}
      onClick={onClick}
      disabled={disabled}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  onClick,
  className,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={cx("icon-button", className)} onClick={onClick} aria-label={label}>
      {icon}
    </button>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cx("search-field", className)}>
      <SearchIcon className="field-icon" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "email" | "password" | "date" | "time" | "datetime-local";
}) {
  return <input className="dashboard-input" type={type} value={value} onChange={onChange} placeholder={placeholder} />;
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      className="dashboard-textarea"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

export function SelectField({
  value,
  onChange,
  options,
  className,
  placeholder,
  disabled,
  required,
  variant = "default",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  variant?: "default" | "inline";
  ariaLabel?: string;
}) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { label: option, value: option } : option));
  const hasEmptyOption = normalizedOptions.some((option) => option.value === "");
  const resolvedValue = value === "" ? (hasEmptyOption ? EMPTY_SELECT_VALUE : undefined) : value;
  const triggerClassName = cx(className, variant === "inline" && "is-inline");

  return (
    <Select
      value={resolvedValue}
      onValueChange={(nextValue) => onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger className={triggerClassName} aria-label={ariaLabel}>
        <SelectValue className="select-field__value" placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {normalizedOptions.map((option) => (
          <SelectItem key={`${option.value}-${option.label}`} value={option.value === "" ? EMPTY_SELECT_VALUE : option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className={cx("checkbox", label && "has-label")}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event.target.checked)} />
      <span />
      {label ? <em>{label}</em> : null}
    </label>
  );
}

export function StatusPill({
  label,
  tone,
  solid = true,
  className,
}: {
  label: string;
  tone: Tone;
  solid?: boolean;
  className?: string;
}) {
  return <span className={cx("status-pill", classForTone(tone), solid ? "is-solid" : "is-soft", className)}>{label}</span>;
}

export function Avatar({ alt, size = "md", className }: AvatarProps) {
  return (
    <span className={cx("avatar", `is-${size}`, className)} role="img" aria-label={alt}>
      <span className="avatar__person" aria-hidden="true">
        <span className="avatar__head" />
        <span className="avatar__body" />
      </span>
    </span>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  spark,
  delta,
  deltaTone = "neutral",
  compact,
}: MetricCardProps) {
  return (
    <article className={cx("metric-card", compact && "is-compact")}>
      <div className="metric-card__head">
        <div>
          <p className="metric-card__title">{title}</p>
          <p className="metric-card__value">{value}</p>
        </div>
        <span className="metric-card__icon">{renderMetricIcon(icon)}</span>
      </div>
      <div className="metric-card__footer">
        <div className="metric-card__meta justify-end">
          {delta ? <span className={cx("metric-card__delta", classForTone(deltaTone))}>{delta}</span> : null}
          <span>{subtitle}</span>
        </div>
        <SparkBars values={spark} />
      </div>
    </article>
  );
}

export function MetricCardSecondary({
  title,
  value,
  subtitle,
  period,
  icon,
  delta,
  deltaTone = "neutral",
  compact,
}: MetricCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<MetricPeriod | "">(period ?? "");

  return (
    <article className={cx("metric-card", compact && "is-compact")}>
      <div className="metric-card__head">
        <div>
          <p className="metric-card__title">{title}</p>
          <p className="metric-card__value">{value}</p>
        </div>
        <span className="metric-card__icon">{renderMetricIcon(icon)}</span>
      </div>
      <div className="metric-card__footer">
        <div className="metric-card__meta">
          {selectedPeriod ? (
            <SelectField
              value={selectedPeriod}
              onChange={(nextValue) => setSelectedPeriod(nextValue as MetricPeriod)}
              options={metricPeriodOptions.map((option) => ({ label: formatMetricPeriod(option), value: option }))}
              variant="inline"
              className="metric-card__period-select"
              ariaLabel={`Select ${title} period`}
            />
          ) : subtitle ? (
            <span>{subtitle}</span>
          ) : null}
        </div>
        {delta ? <span className={cx("metric-card__delta", classForTone(deltaTone))}>{delta}</span> : null}
      </div>
    </article>
  );
}

export function TableActionsMenu({
  items,
  className,
  panelClassName,
}: {
  items: ActionItem[];
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  if (!items.length) {
    return null;
  }

  return (
    <div className={cx("menu-anchor", className)} ref={ref}>
      <IconButton label="More actions" icon={<DotsIcon className="menu-icon" />} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className={cx("menu-panel", panelClassName)}>
          {items.map((item) =>
            item.href ? (
              <Link key={item.label} href={item.href} className={cx("menu-item", item.tone === "danger" && "is-danger")} onClick={() => setOpen(false)}>
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                className={cx("menu-item", item.tone === "danger" && "is-danger")}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  const visible = useMemo(() => {
    const staticPages = [1, 2, 3, 4, 5];
    if (totalPages <= 5) {
      return staticPages.slice(0, totalPages);
    }

    return [...staticPages, "ellipsis", totalPages] as const;
  }, [totalPages]);

  return (
    <div className="pagination">
      <button type="button" className="pagination__edge" onClick={() => onChange(Math.max(1, page - 1))} aria-label="Previous page">
        <ChevronDownIcon className="pagination__arrow rotate-90" />
      </button>
      {visible.map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="pagination__ellipsis">
            ....
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            className={cx("pagination__page", page === entry && "is-active")}
            onClick={() => onChange(entry)}
          >
            {entry}
          </button>
        ),
      )}
      <button type="button" className="pagination__edge" onClick={() => onChange(Math.min(totalPages, page + 1))} aria-label="Next page">
        <ChevronDownIcon className="pagination__arrow -rotate-90" />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options, compact }: TabsProps<T>) {
  return (
    <div className={cx("tabs-strip", compact && "is-compact")}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={cx("tabs-strip__button", value === option && "is-active")}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cx("rating-stars", className)} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon key={index} className={cx("rating-stars__icon", index < rating && "is-filled")} />
      ))}
    </div>
  );
}

export function RatingBreakdown({ rows }: { rows: { label: string; value: string; fill: number }[] }) {
  return (
    <div className="rating-breakdown">
      {rows.map((row) => (
        <div key={row.label} className="rating-breakdown__row">
          <div className="rating-breakdown__label">
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
          <div className="rating-breakdown__track">
            <span style={{ width: `${row.fill}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="info-row">
      <div className="info-row__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="info-row__value">{value}</div>
    </div>
  );
}

export function MapCard({
  title,
  subtitle,
  addressLines,
  image,
}: {
  title: string;
  subtitle?: string;
  addressLines: string[];
  image: string;
}) {
  const [mapVisible, setMapVisible] = useState(false);

  return (
    <div className="map-card">
      <div className="map-card__frame">
        {mapVisible ? (
          <Image src={image} alt={title} fill sizes="420px" />
        ) : (
          <button type="button" className="map-card__loader" onClick={() => setMapVisible(true)}>
            <strong>Load map preview</strong>
            <span>Reveal this location only when you need it.</span>
          </button>
        )}
      </div>
      <div className="map-card__body">
        <h4>{title}</h4>
        {subtitle ? <p>{subtitle}</p> : null}
        {addressLines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </div>
  );
}

export function InfoStat({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div className="info-stat">
      <div className="info-stat__head">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="info-stat__track">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export function ActivityListItem({
  title,
  description,
  meta,
  tone,
}: {
  title: string;
  description: string;
  meta: string;
  tone: Tone;
}) {
  return (
    <div className="activity-item">
      <span className={cx("activity-item__glyph", classForTone(tone))}>{activityIcon(tone)}</span>
      <div className="activity-item__body">
        <div className="activity-item__title-row">
          <h4>{title}</h4>
          <span className={cx("inline-badge", classForTone(tone))}>{tone === "info" ? "Action" : tone === "purple" ? "Security" : tone === "success" ? "Success" : "Alert"}</span>
        </div>
        <p>{description}</p>
        <small>{meta}</small>
      </div>
    </div>
  );
}

export function TimelineStep({
  title,
  date,
  description,
  index,
  completed,
}: {
  title: string;
  date: string;
  description: string;
  index: number;
  completed: boolean;
}) {
  const iconMap = [ClockIcon, PackageIcon, TruckIcon, TruckIcon, CheckCircleIcon] as const;
  const Glyph = iconMap[index] ?? ClockIcon;

  return (
    <div className={cx("timeline-step", completed ? "is-complete" : "is-muted")}>
      <span className="timeline-step__marker">
        <Glyph className="timeline-step__icon" />
      </span>
      <div className="timeline-step__content">
        <h4>{title}</h4>
        <small>{date}</small>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function RevenueChart({ labels, values, tooltipIndex, tooltipLabel, tooltipValue }: RevenueChartProps) {
  const width = 720;
  const height = 250;
  const padding = 28;
  const maxValue = Math.max(...values, 0);
  const max = maxValue > 0 ? maxValue * 1.1 : 1;
  const min = 0;
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const axisLabels = Array.from({ length: 6 }, (_, index) => {
    const value = ((5 - index) / 5) * maxValue;

    if (value >= 1_000_000) {
      return `₦${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
    }

    if (value >= 1_000) {
      return `₦${Math.round(value / 1_000)}K`;
    }

    return `₦${Math.round(value)}`;
  });

  const points = values.map((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((value - min) / (max - min || 1)) * (height - padding * 2);
    return { x, y, value };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = `${path} L ${points[points.length - 1]?.x ?? width} ${height - padding} L ${points[0]?.x ?? padding} ${height - padding} Z`;
  const tooltipPoint = points[tooltipIndex];

  return (
    <div className="revenue-chart">
      <div className="revenue-chart__axis">
        {axisLabels.map((label, index) => (
          <span key={`${index}-${label}`}>{label}</span>
        ))}
      </div>
      <div className="revenue-chart__plot">
        <svg viewBox={`0 0 ${width} ${height}`} className="revenue-chart__svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="revenue-gradient" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#59d06c" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#59d06c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {points.map((point) => (
            <line key={`${point.x}-${point.y}`} x1={point.x} x2={point.x} y1={padding} y2={height - padding} className="revenue-chart__grid" />
          ))}
          <path d={area} fill="url(#revenue-gradient)" />
          <path d={path} className="revenue-chart__line" />
          {tooltipPoint ? (
            <>
              <line x1={tooltipPoint.x} x2={tooltipPoint.x} y1={tooltipPoint.y} y2={height - padding} className="revenue-chart__guide" />
              <circle cx={tooltipPoint.x} cy={tooltipPoint.y} r="5" className="revenue-chart__point" />
            </>
          ) : null}
        </svg>
        {tooltipPoint ? (
          <div className="revenue-chart__tooltip" style={{ left: `${(tooltipPoint.x / width) * 100}%`, top: `${(tooltipPoint.y / height) * 100}%` }}>
            <strong>{tooltipValue}</strong>
            <span>{tooltipLabel}</span>
          </div>
        ) : null}
        <div className="revenue-chart__labels">
          {labels.map((label, index) => (
            <span key={`${index}-${label}`} className={cx(index === tooltipIndex && "is-active")}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReviewCard({
  review,
  showOrderMeta = false,
  actions,
}: {
  review: {
    author: string;
    avatar: string;
    rating: number;
    title: string;
    body: string;
    date: string;
    status?: string;
    statusTone?: Tone;
    media?: string[];
    orderId?: string;
    itemLabel?: string;
  };
  showOrderMeta?: boolean;
  actions?: ActionItem[];
}) {
  return (
    <article className="review-card">
      <div className="review-card__header">
        <div className="review-card__identity">
          <Avatar src={review.avatar} alt={review.author} />
          <div>
            <h4>{review.author}</h4>
            <RatingStars rating={review.rating} />
          </div>
        </div>
        <TableActionsMenu
          items={
            actions ?? [
              { label: "View Review", icon: <EyeIcon className="menu-icon" /> },
              { label: "Delete Review", tone: "danger", icon: <XCircleIcon className="menu-icon" /> },
            ]
          }
          panelClassName="is-review-menu"
        />
      </div>
      {showOrderMeta && review.orderId ? (
        <div className="review-card__order">
          <strong>{review.orderId}</strong>
          <CopyIcon className="mini-icon" />
          <RatingStars rating={review.rating} className="is-inline" />
          {review.status && review.statusTone ? <StatusPill label={review.status} tone={review.statusTone} className="review-status-pill" /> : null}
        </div>
      ) : null}
      {showOrderMeta && review.itemLabel ? (
        <p className="review-card__item">
          <span>Item:</span> <a>{review.itemLabel}</a>
        </p>
      ) : null}
      <h5>{review.title}</h5>
      <p className="review-card__body">{review.body}</p>
      {review.media?.length ? (
        <div className="review-card__media">
          {review.media.map((asset, index) => (
            <span key={`${asset}-${index}`} className="review-card__media-item" aria-hidden="true">
              <span className="product-placeholder" />
            </span>
          ))}
        </div>
      ) : null}
      <small>{review.date}</small>
    </article>
  );
}

export function EmptyScaffold({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="empty-scaffold">
      <div className="empty-scaffold__icon">
        <ProductsIcon className="metric-icon" />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </Panel>
  );
}

export const InfoIcons = {
  calendar: <CalendarIcon className="mini-icon" />,
  mail: <MailIcon className="mini-icon" />,
  phone: <PhoneIcon className="mini-icon" />,
  filter: <FilterIcon className="mini-icon" />,
  sort: <SortIcon className="mini-icon" />,
  eye: <EyeIcon className="mini-icon" />,
};
