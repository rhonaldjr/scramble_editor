// Media blocks (image/video/document/web page/embed) auto-fit the slide they
// live in — scaled to contain, keeping aspect ratio — until the user gives them
// an explicit width (by dragging the corner or the gear). SlideBlock provides
// `scInSlide`; each media block computes its own `fit` from that flag plus its
// live `data.width` (so it reacts to both in-place edits and block replacement).
import { inject } from 'vue';

export function useSlideFit() {
  return { inSlide: Boolean(inject('scInSlide', false)) };
}
