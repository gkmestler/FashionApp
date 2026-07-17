"use client";

import { useState } from "react";
import UploadPanel from "./UploadPanel";
import Wardrobe from "./Wardrobe";
import WeekBuilder from "./WeekBuilder";
import MannequinSettings from "./MannequinSettings";

type Tab = "week" | "wardrobe" | "settings";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "week", label: "Week", icon: "📅" },
  { key: "wardrobe", label: "Wardrobe", icon: "👕" },
  { key: "settings", label: "Mannequin", icon: "🧍" },
];

export default function StylistView() {
  const [tab, setTab] = useState<Tab>("week");
  // Bumped whenever items or the mannequin change, so dependent views reload.
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col gap-5">
      <nav className="flex gap-1 rounded-full border border-border bg-surface p-1 text-sm sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition sm:flex-none ${
              tab === t.key ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "week" && <WeekBuilder refreshKey={refreshKey} />}

      {tab === "wardrobe" && (
        <div className="flex flex-col gap-6">
          <UploadPanel onSaved={refresh} />
          <div className="border-t border-border pt-5">
            <Wardrobe refreshKey={refreshKey} />
          </div>
        </div>
      )}

      {tab === "settings" && <MannequinSettings onChange={refresh} />}
    </div>
  );
}
