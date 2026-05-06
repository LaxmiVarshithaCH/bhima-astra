import { useLayoutEffect } from "react";

/**
 * CSSSection
 *
 * Injects a raw CSS string into <head> as a <style> tag when this component
 * mounts and removes it when the last consumer unmounts.
 *
 * - Uses useLayoutEffect so injection/removal happens BEFORE the browser paints
 *   → zero visible flash, even during route changes within the same section.
 * - Ref-counts by `id` so navigating between sibling routes that share the same
 *   CSS section (e.g. /dashboard → /policy, both "worker") never removes the tag.
 */

const refCounts = new Map<string, number>();

function getOrCreateStyle(id: string, css: string): HTMLStyleElement {
  let el = document.querySelector<HTMLStyleElement>(
    `style[data-css-section="${id}"]`
  );
  if (!el) {
    el = document.createElement("style");
    el.setAttribute("data-css-section", id);
    el.textContent = css;
    document.head.appendChild(el);
  }
  return el;
}

function removeStyle(id: string): void {
  const el = document.querySelector(`style[data-css-section="${id}"]`);
  if (el) el.remove();
}

interface CSSSectionProps {
  /** Unique key for this CSS section (e.g. "landing", "worker", "manager") */
  id: string;
  /** Raw CSS string — processed by Vite/PostCSS/Tailwind via the ?inline import */
  css: string;
  children: React.ReactNode;
}

const CSSSection: React.FC<CSSSectionProps> = ({ id, css, children }) => {
  useLayoutEffect(() => {
    // Increment ref count
    const prev = refCounts.get(id) ?? 0;
    refCounts.set(id, prev + 1);

    // Inject if this is the first consumer
    if (prev === 0) {
      getOrCreateStyle(id, css);
    }

    return () => {
      const next = (refCounts.get(id) ?? 1) - 1;
      refCounts.set(id, next);

      // Remove only when the last consumer unmounts
      if (next === 0) {
        removeStyle(id);
        refCounts.delete(id);
      }
    };
    // `css` is a module-level constant (inline import) — stable reference, no re-run needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return <>{children}</>;
};

export default CSSSection;
