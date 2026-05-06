import { EnergyAuditDetailScreen } from "@/components/dashboard/energy-audit-management";

export default async function QuoteRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EnergyAuditDetailScreen id={id} />;
}
