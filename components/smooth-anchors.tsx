"use client";

import { useEffect } from "react";

// Intercepts clicks on same-page "#id" / "/#id" anchor links and smooth-scrolls
// to the section WITHOUT writing the hash into the URL. Cross-page anchors (the
// target id isn't on this page) fall through and navigate normally.
export function SmoothAnchors() {
  useEffect(() => {
    // on a full refresh, land at the top instead of restoring the old scroll
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href) return;
      const i = href.indexOf("#");
      if (i === -1) return;
      const id = href.slice(i + 1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return; // not on this page — let the browser navigate
      e.preventDefault();
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
