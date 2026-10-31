import { connection } from "next/server";
import { Suspense } from "react";
import { BenchmarkShowcase } from "@/components/benchmark-showcase/benchmark-showcase";
import { ShowcaseSkeleton } from "@/components/benchmark-showcase/showcase-skeleton";
import { env } from "@/env";
import { readLastResult } from "@/lib/read-last-result";

async function Showcase() {
  await connection();
  const initialResult = await readLastResult();
  return <BenchmarkShowcase initialResult={initialResult} runnerUrl={env().RUNNER_URL} />;
}

export default function HomePage() {
  return (
    <main className="page">
      <Suspense fallback={<ShowcaseSkeleton />}>
        <Showcase />
      </Suspense>
    </main>
  );
}
