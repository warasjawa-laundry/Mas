"use client";

import { useEffect } from "react";

/**
 * Some mobile browsers and Next navigation paths restore a previous scroll
 * offset after a public page transition. For a normal membership entry,
 * always reveal the page heading and the two primary actions first.
 * In-page links like #scan-kartu are intentionally preserved.
 */
export default function MembershipScrollEntry() {
  useEffect(() => {
    const reset = () => {
      if (window.location.hash) return;
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    reset();
    // Run after layout as well as on browser history restoration.
    const frame = window.requestAnimationFrame(reset);
    window.addEventListener("pageshow", reset);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", reset);
    };
  }, []);
  return null;
}
