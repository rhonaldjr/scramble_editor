// Corner-drag resize that keeps aspect ratio. We only store `data.width`; the
// media element is width:100% of its frame with height:auto (or a CSS
// aspect-ratio for iframes), so height follows automatically and the ratio is
// preserved. Dragging the corner in any direction scales proportionally.

export function startMediaResize(event, frameEl, block, ctx) {
  if (!frameEl) return;
  const rect = frameEl.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startW = rect.width;
  const startH = rect.height || startW;

  const onMove = (ev) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    // Average the horizontal and vertical drag so pulling the corner down/right
    // grows the media (and up/left shrinks it) while keeping the ratio.
    const scale = 1 + (dx / startW + dy / startH) / 2;
    const width = Math.max(80, Math.round(startW * scale));
    block.data.width = width;
    ctx.emitEvent('media:resized', { id: block.id, width });
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    ctx.emitEvent('block:updated', { id: block.id });
    ctx.markChanged();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
