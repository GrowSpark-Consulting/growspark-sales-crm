"use client";

import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@growspark/shared";

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/v1/health");
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export default function Home() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  return (
    <main>
      <h1>Grow Spark Sales &amp; CRM</h1>
      {isLoading && <p>Checking API status...</p>}
      {error && <p>API status: error ({error.message})</p>}
      {data && (
        <p>
          API status: {data.status} (as of {data.timestamp})
        </p>
      )}
    </main>
  );
}
