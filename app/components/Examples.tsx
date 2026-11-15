"use client";
import { PlayCircle } from "@phosphor-icons/react/dist/ssr/PlayCircle";
import { useEffect, useState } from "react";
import type { Example } from "../lib/replay";
import { useToast } from "./Toast";
export default function Examples({
  onSelect,
}: {
  onSelect: (example: Example) => void;
}) {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const notify = useToast();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    fetch("/examples/index.json")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});
  }, []);
  async function open(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`/examples/${encodeURIComponent(id)}.json`);
      if (!response.ok) throw new Error();
      onSelect(await response.json());
    } catch {
      notify({
        tone: "error",
        title: "Couldn’t load example",
        message: "Please try again.",
      });
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
          {item.title}
          <PlayCircle size={20} weight="duotone" aria-hidden="true" />
        </button>
      ))}
      <small>Recorded research. Replays without API calls.</small>
    </div>
  );
}
