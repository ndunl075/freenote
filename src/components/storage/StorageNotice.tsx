"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { requestPersistence } from "@/lib/db";
import { spring } from "@/lib/motion/springs";

/* ============================================================================
   The iOS storage warning.

   This is the most important piece of honesty in the app. On iPhone and iPad,
   Safari deletes a website's IndexedDB after **seven days without a visit**.
   For a note-taking app that stores everything locally, that is silent, total
   data loss for anyone who takes notes and then goes on holiday.

   Adding the site to the Home Screen exempts it from that policy. So on iOS
   Safari, outside standalone mode, we say so plainly and tell people exactly
   which button to press. Burying this in a settings page would be negligent.
   ========================================================================= */

const DISMISS_KEY = "freenote.storage-notice-dismissed";

function isApplePortable(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points are the give-away.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function StorageNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Ask for persistent storage everywhere. Browsers that honour it stop
    // evicting us under disk pressure; the ones that ignore it lose nothing.
    void requestPersistence();

    // Deferred by a beat: the banner should settle in after the app has
    // painted rather than flashing up as part of first render.
    const timer = setTimeout(() => {
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* private mode — show it; the risk is realer there anyway */
      }
      if (!dismissed && isApplePortable() && !isStandalone()) setShow(true);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* nothing to do */
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1, transition: spring.sheet }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden border-b border-[var(--tint-amber-line)] bg-[var(--tint-amber)]"
          role="status"
        >
          <div className="mx-auto flex max-w-[900px] items-start gap-3 px-4 py-3">
            <Share className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--tint-amber-ink)]" aria-hidden />
            <p className="flex-1 text-[13px] leading-relaxed text-[var(--tint-amber-ink)]">
              <strong className="font-extrabold">Add FreeNote to your Home Screen.</strong>{" "}
              Safari deletes a website&rsquo;s saved data after 7 days without a visit, and
              that would take your notes with it. Tap{" "}
              <span className="font-semibold">Share</span> then{" "}
              <span className="font-semibold">Add to Home Screen</span> and your notes are
              kept for good.
            </p>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded-full p-1 text-[var(--tint-amber-ink)] opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
