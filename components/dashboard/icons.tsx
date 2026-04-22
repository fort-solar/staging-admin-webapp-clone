"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5v14" />
      <path d="M10 7v10" />
      <path d="M15 12h5" />
      <path d="m17 9-3 3 3 3" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 18h8" />
      <path d="M10.4 20a1.6 1.6 0 0 0 3.2 0" />
      <path d="M6.5 15.5c.9-1 1.5-2.8 1.5-5 0-2.8 1.8-4.5 4-4.5s4 1.7 4 4.5c0 2.2.6 4 1.5 5" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2.2" />
      <path d="M12 19.3v2.2" />
      <path d="m4.9 4.9 1.5 1.5" />
      <path d="m17.6 17.6 1.5 1.5" />
      <path d="M2.5 12h2.2" />
      <path d="M19.3 12h2.2" />
      <path d="m4.9 19.1 1.5-1.5" />
      <path d="m17.6 6.4 1.5-1.5" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16.5 3.5a7.6 7.6 0 1 0 4 13.8A8.4 8.4 0 0 1 16.5 3.5Z" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 9.5 12 4l7.5 5.5v8a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2Z" />
      <path d="M9.5 20v-5.5a2.5 2.5 0 0 1 5 0V20" />
    </Svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M4.5 18c.7-2.7 3-4.5 6-4.5S15.8 15.3 16.5 18" />
      <path d="M15.3 18c.4-1.8 1.8-3.1 3.7-3.5" />
    </Svg>
  );
}

export function OrdersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
      <path d="M3.5 5H6l2.5 9.5H18l2-6.5H7.2" />
    </Svg>
  );
}

export function NotificationIcon(props: IconProps) {
  return <BellIcon {...props} />;
}

export function ProductsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3 7 4-7 4-7-4 7-4Z" />
      <path d="m5 7 7 4 7-4" />
      <path d="M5 11v6l7 4 7-4v-6" />
    </Svg>
  );
}

export function BundlesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="4.5" width="7" height="7" rx="1.4" />
      <rect x="12.5" y="4.5" width="7" height="7" rx="1.4" />
      <rect x="4.5" y="12.5" width="7" height="7" rx="1.4" />
      <path d="M12.5 14.5h7v5h-7z" />
    </Svg>
  );
}

export function TransactionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="2" />
      <path d="M4.5 9.5h15" />
      <path d="M8 14h3" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2" />
      <path d="M12 18.5v2" />
      <path d="m5.8 5.8 1.4 1.4" />
      <path d="m16.8 16.8 1.4 1.4" />
      <path d="M3.5 12h2" />
      <path d="M18.5 12h2" />
      <path d="m5.8 18.2 1.4-1.4" />
      <path d="m16.8 7.2 1.4-1.4" />
    </Svg>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 20H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4H11" />
      <path d="M14 16.5 19 12l-5-4.5" />
      <path d="M19 12H9" />
    </Svg>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7h14" />
      <path d="M8 12h8" />
      <path d="M10 17h4" />
    </Svg>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 6v12" />
      <path d="m5.5 8.5 2.5-2.5 2.5 2.5" />
      <path d="M16 18V6" />
      <path d="m13.5 15.5 2.5 2.5 2.5-2.5" />
    </Svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 7.5h10A2.5 2.5 0 0 1 19.5 10v7A2.5 2.5 0 0 1 17 19.5H7A2.5 2.5 0 0 1 4.5 17v-7A2.5 2.5 0 0 1 7 7.5Z" />
      <path d="M8.5 7.5 10 5.5h4l1.5 2" />
      <circle cx="12" cy="13" r="3" />
    </Svg>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 4.5h9l3 3V18a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 18v-12A1.5 1.5 0 0 1 7 4.5Z" />
      <path d="M9 4.5V9h6V6.5" />
      <path d="M8.5 19.5v-5h7v5" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m5 8 7 5 7-5" />
    </Svg>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5v5A2.5 2.5 0 0 1 15.5 15H11l-3.5 3v-3H8.5A2.5 2.5 0 0 1 6 12.5Z" />
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 4.5c1.2-.3 2.4.3 3 1.4l.7 1.3c.4.8.2 1.8-.5 2.4l-.9.8a14.7 14.7 0 0 0 4.8 4.8l.8-.9c.6-.7 1.6-.9 2.4-.5l1.3.7c1.1.6 1.7 1.8 1.4 3l-.1.4c-.3 1.2-1.4 2-2.7 2A13.8 13.8 0 0 1 4 7.3c0-1.3.8-2.4 2-2.7Z" />
    </Svg>
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15" />
      <path d="M12 4c2.1 2.2 3.2 5 3.2 8s-1.1 5.8-3.2 8" />
      <path d="M12 4c-2.1 2.2-3.2 5-3.2 8s1.1 5.8 3.2 8" />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
      <path d="M4.5 9h15" />
    </Svg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8.5" cy="12" r="3" />
      <path d="M11.5 12H20" />
      <path d="M16 12v2.5" />
      <path d="M18 12v1.5" />
    </Svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7.5h12.5A2.5 2.5 0 0 1 20 10v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5A2.5 2.5 0 0 1 6.5 6H18" />
      <path d="M15.5 13.5h4" />
      <circle cx="15.5" cy="13.5" r=".9" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function BankIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4.5 9 7.5-4 7.5 4" />
      <path d="M5.5 9.5h13" />
      <path d="M7.5 9.5V18" />
      <path d="M10.5 9.5V18" />
      <path d="M13.5 9.5V18" />
      <path d="M16.5 9.5V18" />
      <path d="M4.5 18.5h15" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 18.5 6v5.5c0 4.1-2.8 6.9-6.5 9-3.7-2.1-6.5-4.9-6.5-9V6Z" />
    </Svg>
  );
}

export function ShieldOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 18.5 6v5.5c0 4.1-2.8 6.9-6.5 9-3.7-2.1-6.5-4.9-6.5-9V6Z" />
      <path d="m5 5 14 14" />
    </Svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 7.5h10v7h-10Z" />
      <path d="M13.5 10h3l2 2v2.5h-5Z" />
      <circle cx="7" cy="17" r="1.5" />
      <circle cx="17" cy="17" r="1.5" />
    </Svg>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3.5 7 4v9l-7 4-7-4v-9l7-4Z" />
      <path d="m5 7.5 7 4 7-4" />
      <path d="M12 11.5v9" />
    </Svg>
  );
}

export function BarChartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19V9" />
      <path d="M10 19V5" />
      <path d="M15 19v-7" />
      <path d="M20 19V8" />
    </Svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m12 3.5 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.5Z" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <path d="M6.5 14H6A2 2 0 0 1 4 12V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v.5" />
    </Svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s-6.5-4.6-8.5-8.5A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 5.5C18.5 15.4 12 20 12 20Z" />
    </Svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12h4l2-4 4.5 8 2.5-4H20.5" />
    </Svg>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 20V4" />
      <path d="m6 5 10-1v7l-10 1" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.7 12 2.2 2.2 4.4-4.4" />
    </Svg>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="m9.2 9.2 5.6 5.6" />
      <path d="m14.8 9.2-5.6 5.6" />
    </Svg>
  );
}

export function BanIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="m7.8 7.8 8.4 8.4" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 7.5h13" />
      <path d="M9 4.5h6" />
      <path d="M8 7.5V18a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 18V7.5" />
      <path d="M10.5 10.5v5.5" />
      <path d="M13.5 10.5v5.5" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 20 18H4Z" />
      <path d="M12 9v4" />
      <path d="M12 16h.01" />
    </Svg>
  );
}
