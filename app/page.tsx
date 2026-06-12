import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="p-8">
      <Card className="p-6 max-w-sm">
        <h1 className="text-xl font-semibold">Skeleton ready</h1>
        <Button className="mt-4">Smoke test</Button>
      </Card>
    </main>
  );
}
