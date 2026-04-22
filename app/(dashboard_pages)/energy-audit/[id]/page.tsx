import { notFound } from "next/navigation";
import { EnergyAuditDetailScreen } from "@/components/dashboard/energy-audit-management";
import { getQuoteRequestById } from "@/lib/operations-data";

export default async function QuoteRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = getQuoteRequestById(id);

  if (!quote) {
    notFound();
  }

  return <EnergyAuditDetailScreen quote={quote} />;
}
