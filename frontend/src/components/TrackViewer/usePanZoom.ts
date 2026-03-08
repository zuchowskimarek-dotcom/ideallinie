import { useState, useCallback, useRef } from "react";

interface PanZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

export function usePanZoom(options?: { minScale?: number; maxScale?: number }) {
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

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setState((prev) => {
        const newScale = Math.max(minScale, Math.min(maxScale, prev.scale * delta));
        return { ...prev, scale: newScale };
      });
    },
    [minScale, maxScale]
  );

  const reset = useCallback(() => {
    setState({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const transform = `translate(${state.translateX} ${state.translateY}) scale(${state.scale})`;

  return {
    transform,
    scale: state.scale,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, onWheel },
    reset,
  };
}
