"use client";

import { use, useEffect, useState } from "react";
import { BundleDetailScreen } from "@/components/dashboard/bundles-management";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { EmptyScaffold, Panel } from "@/components/dashboard/ui";
import { getPackageBySlug } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { PackageRecord } from "@/types/api.types";

export default function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [pkg, setPkg] = useState<PackageRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    getPackageBySlug(slug)
      .then((record) => {
        if (cancelled) {
          return;
        }

        setPkg(record);
        setError(null);
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        setError(getErrorMessage(loadError, "Package details could not be loaded."));
        setPkg(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (pkg) {
    return <BundleDetailScreen bundle={pkg} />;
  }

  return (
    <Panel className="p-6">
      <ErrorMessage title="Package load failed" message={error} />
      {isLoading ? <p className="section-description">Loading package...</p> : <EmptyScaffold title="No package found" description="No record found on the database" />}
    </Panel>
  );
}
