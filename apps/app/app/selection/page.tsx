'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    electronAPI: {
      captureArea: (bounds: { x: number; y: number; width: number; height: number }) => void;
      cancelScreenshot: () => void;
    };
  }
}

export default function SelectionPage() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  let isSelecting = false;
  let startX = 0;
  let startY = 0;

  useEffect(() => {
    const overlay = overlayRef.current;
    const selection = selectionRef.current;

    if (!overlay || !selection) return;

    const finishSelection = () => {
      if (!isSelecting) return;
      isSelecting = false;

      const bounds = selection.getBoundingClientRect();
      console.log('[Selection] Selection bounds:', bounds);
      
      if (bounds.width > 0 && bounds.height > 0) {
        selection.style.display = 'none';
        overlay.style.display = 'none';
        
        console.log('[Selection] Calling captureArea with bounds:', {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height)
        });
        
        setTimeout(() => {
          if (window.electronAPI?.captureArea) {
            window.electronAPI.captureArea({
              x: Math.round(bounds.x),
              y: Math.round(bounds.y),
              width: Math.round(bounds.width),
              height: Math.round(bounds.height)
            });
            console.log('[Selection] captureArea called');
          } else {
            console.error('[Selection] window.electronAPI.captureArea is not available');
          }
          router.push('/');
        }, 100);
      } else {
        console.log('[Selection] Invalid selection bounds:', bounds);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      console.log('[Selection] Mouse down at:', e.clientX, e.clientY);
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selection.style.display = 'block';
      selection.style.left = startX + 'px';
      selection.style.top = startY + 'px';
      selection.style.width = '0';
      selection.style.height = '0';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;

      const currentX = e.clientX;
      const currentY = e.clientY;

      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      selection.style.left = Math.min(startX, currentX) + 'px';
      selection.style.top = Math.min(startY, currentY) + 'px';
      selection.style.width = width + 'px';
      selection.style.height = height + 'px';
    };

    const handleMouseUp = () => {
      console.log('[Selection] Mouse up');
      finishSelection();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[Selection] Escape pressed, cancelling screenshot');
        window.electronAPI.cancelScreenshot();
        router.push('/');
      } else if (e.key === 'Enter' || e.key === 'Return') {
        console.log('[Selection] Enter pressed, finishing selection');
        finishSelection();
      }
    };

    overlay.addEventListener('mousedown', handleMouseDown);
    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      overlay.removeEventListener('mousedown', handleMouseDown);
      overlay.removeEventListener('mousemove', handleMouseMove);
      overlay.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  return (
    <div className="fixed inset-0">
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/30 cursor-crosshair z-50"
      />
      <div
        ref={selectionRef}
        className="absolute border-2 border-green-500 bg-green-500/10 hidden z-50 pointer-events-none"
      />
      <div className="fixed top-2.5 left-2.5 text-white bg-black/70 p-2.5 rounded z-50 pointer-events-none text-sm">
        Click and drag to select an area<br />
        Release mouse or press Enter to capture<br />
        Press ESC to cancel
      </div>
    </div>
  );
} 