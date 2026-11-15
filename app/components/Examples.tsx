"use client";
import { PlayCircle } from "@phosphor-icons/react/dist/ssr/PlayCircle";
import { useEffect, useState } from "react";
import type { Example } from "../lib/replay";
export default function Examples({
  onSelect,
}: {
  onSelect: (example: Example) => void;
}) {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch("/examples/index.json")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});
  }, []);
  async function open(id: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/examples/${encodeURIComponent(id)}.json`);
      if (!response.ok) throw new Error();
      onSelect(await response.json());
    } catch {
      setError("This example could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  if (!items.length) return null;
  return (
    <div className="recorded-examples">
      <span className="eyebrow">Recorded Examples</span>
      {items.map((item) => (
        <button
          className="example"
          disabled={loading}
          key={item.id}
          onClick={() => void open(item.id)}
        >
          {(
            {
              "python-support": "Python Support",
              "nextjs-release": "Next.js Release",
              "copilot-pricing": "Copilot Pricing",
              "nvidia-sales": "NVIDIA Brief",
              "microsoft-partnership": "Microsoft Brief",
            } as Record<string, string>
          )[item.id] || "Play Example"}
          <PlayCircle size={20} weight="duotone" aria-hidden="true" />
        </button>
      ))}
      <small>Recorded research. Replays without API calls.</small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
