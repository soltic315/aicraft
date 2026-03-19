import { useState, useRef, useEffect } from 'preact/hooks';

export function useDraggable() {
  const [pos, setPos] = useState(null); // null = CSSデフォルト位置
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current) return;
      const panel = panelRef.current;
      const w = panel ? panel.offsetWidth : 200;
      const h = panel ? panel.offsetHeight : 100;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - w, e.clientX - offset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - h, e.clientY - offset.current.y)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging.current = true;
    e.preventDefault();
  };

  const dragStyle = pos
    ? { left: pos.x + 'px', top: pos.y + 'px', transform: 'none', right: 'auto', bottom: 'auto' }
    : {};

  return { panelRef, dragStyle, onHeaderMouseDown };
}
