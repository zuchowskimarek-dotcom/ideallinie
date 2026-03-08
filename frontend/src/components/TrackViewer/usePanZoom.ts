import { useState, useCallback, useRef, useEffect } from "react";

interface PanZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function usePanZoom(
  wheelTargetRef: React.RefObject<HTMLElement | null>,
  options?: { minScale?: number; maxScale?: number },
) {
  const minScale = options?.minScale ?? 0.1;
  const maxScale = options?.maxScale ?? 20;

  const [state, setState] = useState<PanZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setState((prev) => ({
      ...prev,
      translateX: prev.translateX + dx / prev.scale,
      translateY: prev.translateY + dy / prev.scale,
    }));
  }, []);

  const onMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const onMouseLeave = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Attach wheel listener as non-passive so preventDefault() actually works
  // and scroll/zoom doesn't leak to the rest of the page.
  useEffect(() => {
    const el = wheelTargetRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setState((prev) => {
        const newScale = Math.max(minScale, Math.min(maxScale, prev.scale * delta));
        return { ...prev, scale: newScale };
      });
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [wheelTargetRef, minScale, maxScale]);

  const reset = useCallback(() => {
    setState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  /**
   * Ensure a point (in SVG group-local coords, AFTER y-flip) is visible
   * within the canvas container, with at least `padding` px from each edge.
   *
   * @param gx   SVG group-local X  (= trackPoint.pos.x)
   * @param gy   SVG group-local Y  (= -trackPoint.pos.y, already y-flipped)
   * @param vb   The SVG viewBox {x, y, w, h}
   * @param containerEl  The canvas DOM element (for pixel dimensions)
   * @param padding  Minimum pixel distance from edge (default 20)
   */
  const ensureVisible = useCallback(
    (gx: number, gy: number, vb: ViewBox, containerEl: HTMLElement | null, padding = 20) => {
      if (!containerEl) return;
      const cW = containerEl.clientWidth;
      const cH = containerEl.clientHeight;
      if (cW === 0 || cH === 0) return;

      setState((prev) => {
        const S = prev.scale;
        const TX = prev.translateX;
        const TY = prev.translateY;

        // Point in parent SVG coords (after group transform)
        const svgX = TX + gx * S;
        const svgY = TY + gy * S;

        // ViewBox -> screen mapping (preserveAspectRatio xMidYMid meet)
        const ratio = Math.min(cW / vb.w, cH / vb.h);
        const offsetX = (cW - vb.w * ratio) / 2;
        const offsetY = (cH - vb.h * ratio) / 2;

        const screenX = offsetX + (svgX - vb.x) * ratio;
        const screenY = offsetY + (svgY - vb.y) * ratio;

        let newTX = TX;
        let newTY = TY;

        if (screenX < padding) {
          newTX = TX + (padding - screenX) / ratio;
        } else if (screenX > cW - padding) {
          newTX = TX - (screenX - (cW - padding)) / ratio;
        }

        if (screenY < padding) {
          newTY = TY + (padding - screenY) / ratio;
        } else if (screenY > cH - padding) {
          newTY = TY - (screenY - (cH - padding)) / ratio;
        }

        if (newTX === TX && newTY === TY) return prev;
        return { ...prev, translateX: newTX, translateY: newTY };
      });
    },
    []
  );

  const transform = `translate(${state.translateX} ${state.translateY}) scale(${state.scale})`;

  return {
    transform,
    scale: state.scale,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onDoubleClick: reset },
    reset,
    ensureVisible,
  };
}
