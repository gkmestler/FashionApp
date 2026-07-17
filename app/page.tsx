"use client";

import { useState } from "react";
import StylistView from "@/components/stylist/StylistView";
import MyView from "@/components/my/MyView";

type View = "stylist" | "my";

export default function Home() {
  const [view, setView] = useState<View>("stylist");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧵</span>
            <h1 className="text-base font-semibold tracking-tight">Weekly Stylist</h1>
          </div>

          {/* The soft view toggle — no auth, just swaps what's on screen. */}
          <div className="flex rounded-full border border-border bg-surface p-0.5 text-sm">
            <button
              onClick={() => setView("stylist")}
              className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                view === "stylist" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              Stylist
            </button>
            <button
              onClick={() => setView("my")}
              className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                view === "my" ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              My view
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7">
        {view === "stylist" ? <StylistView /> : <MyView />}
      </main>
    </div>
  );
}
