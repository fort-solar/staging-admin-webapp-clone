import { formatDateTimeLabel, formatEnumLabel } from "@/lib/admin-api";
import { toneFromStatus, type Tone } from "@/lib/dashboard-data";
import type { AdminActivityRecord } from "@/types/api.types";

export type NormalizedAdminActivity = {
  id: string;
  title: string;
  description: string;
  meta: string;
  tone: Tone;
  createdAt: string | null;
  detailEntries: Array<{ label: string; value: string }>;
};

function readString(record: AdminActivityRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readValue(record: AdminActivityRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function toDetailEntries(record: AdminActivityRecord) {
  return Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 8)
    .map(([key, value]) => ({
      label: formatEnumLabel(key),
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
}

export function normalizeAdminActivity(record: AdminActivityRecord, index: number): NormalizedAdminActivity {
  const createdAt = readString(record, ["created_at", "occurred_at", "timestamp", "updated_at"]);
  const action = readString(record, ["action", "event", "activity", "type", "kind"]);
  const entity = readString(record, ["entity", "entity_type", "resource", "module"]);
  const actor = readString(record, ["admin_name", "actor_name", "user_name", "performed_by_name", "admin_email", "actor_email", "user_email"]);
  const target = readString(record, ["target_name", "target_id", "subject_id", "entity_id", "resource_id"]);
  const status = readString(record, ["status", "result", "outcome"]);
  const title =
    readString(record, ["title"]) ??
    [action ? formatEnumLabel(action) : "Activity", entity ? formatEnumLabel(entity) : "Log"]
      .filter(Boolean)
      .join(" ");
  const description =
    readString(record, ["description", "message", "summary", "details"]) ??
    [
      actor ? `${actor} recorded an update.` : "An admin activity event was recorded.",
      target ? `Target: ${target}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
  const meta = [
    createdAt ? formatDateTimeLabel(createdAt) : null,
    actor,
    status ? formatEnumLabel(status) : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const toneSource = status ?? action ?? (readValue(record, ["deleted"]) ? "deactivated" : "info");

  return {
    id: readString(record, ["id"]) ?? `${createdAt ?? "activity"}-${index}`,
    title,
    description,
    meta: meta || "Admin activity log",
    tone: toneFromStatus(String(toneSource)),
    createdAt,
    detailEntries: toDetailEntries(record),
  };
}
