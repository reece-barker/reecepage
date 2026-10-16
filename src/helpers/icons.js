// The icon set. Drawn for this site on a 20 by 20 grid: solid shapes, square corners and a diamond (the leaf turned
// on its point) where other sets would use a circle. No thin outlines, they disappear next to the bold type.
// Icons are decorative by default (aria-hidden), the text next to them carries the meaning.

const PATHS = {
  arrow: '<path d="M2 9h11v2H2z"/><path d="M11 4l7 6-7 6z"/>',
  "arrow-left": '<path d="M7 9h11v2H7z"/><path d="M9 4L2 10l7 6z"/>',
  mail: '<path fill-rule="evenodd" d="M2 4h16v12H2zm1.6 1.7v1.8L10 12l6.4-4.5V5.7L10 10.2z"/>',
  menu: '<path d="M2 4h16v2.4H2zM2 8.8h16v2.4H2zM2 13.6h16V16H2z"/>',
  close: '<path d="M4.3 2.6L10 8.3l5.7-5.7 1.7 1.7L11.7 10l5.7 5.7-1.7 1.7L10 11.7l-5.7 5.7-1.7-1.7L8.3 10 2.6 4.3z"/>',
  sun: '<circle cx="10" cy="10" r="4"/><path d="M9 0h2v3H9zM9 17h2v3H9zM0 9h3v2H0zM17 9h3v2h-3zM2.6 4l1.4-1.4 2 2L4.6 6zM14 15.4l1.4-1.4 2 2-1.4 1.4zM14 4.6l2-2L17.4 4l-2 2zM2.6 16l2-2L6 15.4l-2 2z"/>',
  moon: '<path d="M12.5 1.5a8.5 8.5 0 1 0 6 13.9A7.2 7.2 0 0 1 12.5 1.5z"/>',
  copy: '<path d="M7 2h11v11h-2.2V4.2H7z"/><path d="M2 7h11v11H2z"/>',
  check: '<path d="M1.8 10.2l2.6-2.6 3.8 3.8 7.4-7.4 2.6 2.6-10 10z"/>',
  alert: '<path fill-rule="evenodd" d="M10 .8l9.2 9.2-9.2 9.2L.8 10zM9 5h2v6.5H9zm0 8h2v2H9z"/>',
  info: '<path fill-rule="evenodd" d="M10 .8l9.2 9.2-9.2 9.2L.8 10zM9 8.5h2V15H9zm0-3.5h2v2H9z"/>',
  external: '<path d="M10 2h8v8h-2.2V5.8l-7 7-1.6-1.6 7-7H10z"/><path d="M2 5h6v2.2H4.2v8.6h8.6V12H15v6H2z"/>',
  leaf: '<path d="M10 2l8 8-8 8-8-8z"/>',
  play: '<path d="M5 2.5v15l12-7.5z"/>',
  upload: '<path d="M10 1.5l6 6-1.6 1.6-3.3-3.3V14H8.9V5.8L5.6 9.1 4 7.5z"/><path d="M2 16h16v2.4H2z"/>'
};

/**
 * @param {string} name
 * @param {{ label?: string, className?: string }} [options] a label makes the icon readable by screen readers
 */
export function iconSvg(name, { label, className = "icon" } = {}) {
  const paths = PATHS[name];
  if (!paths) throw new Error(`Unknown icon "${name}"`);
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${className}" viewBox="0 0 20 20" fill="currentColor" ${a11y}>${paths}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
