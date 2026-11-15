"use client";

import { useState } from "react";
import { ShareNetwork } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { useToast } from "./Toast";

export default function ShareBrief({ briefId }: { briefId: string }) {
  const notify = useToast();
  const [copying, setCopying] = useState(false);
  async function share() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/brief/${briefId}`,
      );
      notify({
        tone: "success",
        title: "Share link copied",
        message: "Anyone with the link can open this brief until it expires.",
      });
    } catch {
      notify({
        tone: "error",
        title: "Couldn’t copy link",
        message: "Open the saved brief and copy its address from your browser.",
      });
    } finally {
      setCopying(false);
    }
  }
  return (
    <button className="secondary" onClick={share} disabled={copying}>
      <ShareNetwork size={18} weight="duotone" aria-hidden="true" />
      {copying ? "Copying" : "Share Brief"}
    </button>
  );
}
