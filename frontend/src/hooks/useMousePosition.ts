import { useEffect, useState } from 'react';

export const useMousePosition = (elementRef: React.RefObject<HTMLElement>) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPosition({ x, y });
    };

    element.addEventListener('mousemove', handleMouseMove);
    return () => element.removeEventListener('mousemove', handleMouseMove);
  }, [elementRef]);

  return position;
};
