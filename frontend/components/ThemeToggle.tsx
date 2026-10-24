"use client";

import type { MouseEvent } from "react";
import { useId, useState, useSyncExternalStore } from "react";
import { THEME_KEY } from "../lib/theme";

/* The <html> class is the single source of truth, so every toggle
   on the page (desktop + mobile) stays in sync automatically. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => true;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // private mode: the theme still applies for this visit
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Icon animates only after the first click, never on page load
  const [armed, setArmed] = useState(false);
  const maskId = `moon-${useId().replace(/:/g, "")}`;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setArmed(true);

    const next = dark ? "light" : "dark";
    const doc = document as ViewTransitionDocument;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (!doc.startViewTransition || reduceMotion) {
      applyTheme(next);
      return;
    }

    // The reveal grows out of the button, wherever it was activated from
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = doc.startViewTransition(() => applyTheme(next));

    void transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 600,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  };

  const move = armed
    ? "transform 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease"
    : "none";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 ring-1 ring-inset ring-slate-300 transition-colors hover:bg-slate-900/5 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-300 dark:ring-white/15 dark:hover:bg-white/5 dark:hover:text-white dark:focus-visible:outline-indigo-400 ${className}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          {/* Slides in over the sun to carve the crescent */}
          <circle
            cx="24"
            cy="0"
            r="6"
            fill="black"
            style={{
              transform: dark ? "translate(-7px, 7px)" : "translate(0px, 0px)",
              transition: move,
            }}
          />
        </mask>

        <g mask={`url(#${maskId})`}>
          <circle
            cx="12"
            cy="12"
            r="5"
            fill="currentColor"
            style={{
              transform: dark ? "scale(1.8)" : "scale(1)",
              transformOrigin: "12px 12px",
              transition: move,
            }}
          />
        </g>

        {/* Sun rays spin away and shrink into the moon */}
        <g
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            opacity: dark ? 0 : 1,
            transform: dark ? "rotate(90deg) scale(0.5)" : "rotate(0deg) scale(1)",
            transformOrigin: "12px 12px",
            transition: move,
          }}
        >
          <path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4L6 18M18 6l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}