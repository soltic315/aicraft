import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { useArmorStore } from '../../stores/armorStore.js';

export function ArmorDisplay() {
  const containerRef = useRef(null);

  useEffect(() => {
    return useArmorStore.subscribe((state) => {
      if (!containerRef.current) return;
      const { totalDefense } = state;
      containerRef.current.style.display = totalDefense > 0 ? 'flex' : 'none';
      // シールドアイコンを防御値に応じて塗りつぶし
      const icons = containerRef.current.querySelectorAll('.armor-icon');
      icons.forEach((icon, i) => {
        const filled = i < totalDefense;
        icon.style.opacity = filled ? '1' : '0.25';
        icon.style.filter = filled ? 'none' : 'grayscale(1)';
      });
    });
  }, []);

  // 最大20個のシールドアイコン（防御ポイント最大値）
  const icons = Array.from({ length: 20 }, (_, i) => (
    <span key={i} class="armor-icon" style={{ opacity: 0.25, filter: 'grayscale(1)' }}>🛡</span>
  ));

  return (
    <div id="armor-hud" ref={containerRef} style={{ display: 'none' }} aria-live="polite">
      <span id="armor-label">防具</span>
      <div id="armor-icons">{icons}</div>
    </div>
  );
}
