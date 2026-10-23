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
  upload: '<path d="M10 1.5l6 6-1.6 1.6-3.3-3.3V14H8.9V5.8L5.6 9.1 4 7.5z"/><path d="M2 16h16v2.4H2z"/>',
  // The admin's own, same rules: solid, square corners
  dashboard: '<path d="M2 2h7v9H2zM11 2h7v5h-7zM11 9h7v9h-7zM2 13h7v5H2z"/>',
  pen: '<path d="M14.2 1.6l4.2 4.2L7.6 16.6 2 18l1.4-5.6z"/><path d="M11 18h7v-2.2h-7z"/>',
  page: '<path fill-rule="evenodd" d="M3 1h10l4 4v14H3zm3 7v1.8h8V8zm0 3.6v1.8h8v-1.8zm0 3.6V17h5v-1.8z"/>',
  grid: '<path fill-rule="evenodd" d="M1 4h7l2 2h9v11H1zm2 4v7h14V8z"/>',
  tool: '<path d="M12.5 1a5.5 5.5 0 0 0-5.2 7.3L1 14.6 5.4 19l6.3-6.3A5.5 5.5 0 0 0 19 7.5l-3.3 3.3-3.5-1-1-3.5L14.5 3A5.6 5.6 0 0 0 12.5 1z"/>',
  image: '<path fill-rule="evenodd" d="M1 3h18v14H1zm2 2v10h14V5z"/><path d="M4 14l4-5 3 3.2 2-2.2 3 4z"/><path d="M12.5 6h3v3h-3z"/>',
  list: '<path d="M2 3h3v3H2zM7 3.5h11v2H7zM2 8.5h3v3H2zM7 9h11v2H7zM2 14h3v3H2zM7 14.5h11v2H7z"/>',
  spark: '<path d="M10 1l2.4 6.6L19 10l-6.6 2.4L10 19l-2.4-6.6L1 10l6.6-2.4z"/>',
  quote: '<path d="M2 4h7v7l-3 5H3l2-5H2zM11 4h7v7l-3 5h-3l2-5h-3z"/>',
  clock: '<path fill-rule="evenodd" d="M10 1a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9 4.5V11l4.6 2.7 1-1.8-3.4-2V4.5z"/>',
  home: '<path d="M10 1.5l9 8h-2.6V18h-4.8v-5.5H8.4V18H3.6V9.5H1z"/>',
  tree: '<path d="M10 1l6 6h-3l4.5 5H13v6H7v-6H2.5L7 7H4z"/>',
  settings: '<path d="M2 4h16v2H2zM2 9h16v2H2zM2 14h16v2H2z"/><path d="M12 2h3v6h-3zM4 7h3v6H4zM10 12h3v6h-3z"/>',
  scale: '<path d="M9 1h2v2.2l6 1.6V7h-2l2.8 6.5a3.6 3.6 0 0 1-7 0L13.6 7H11v10h4v2H5v-2h4V7H6.4l2.8 6.5a3.6 3.6 0 0 1-7 0L5 7H3V4.8l6-1.6z"/>',
  sync: '<path d="M5 1l5 5.5H6.2V14H3.8V6.5H0zM15 19l-5-5.5h3.8V6h2.4v7.5H20z"/>',
  pulse: '<path d="M7.2 3.5l3.4 9.3 2-4.8h6.4v2.4h-4.8l-3.8 8.6L7 8.4 5.8 11.4H1V9h3.2z"/>',
  key: '<path fill-rule="evenodd" d="M7 2a6 6 0 0 1 5.6 8.2L19 16.6V19h-3.4v-2h-2v-2h-2l-1.8-1.8A6 6 0 1 1 7 2zm-.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>',
  eye: '<path fill-rule="evenodd" d="M10 4c4.6 0 8 3.4 9 6-1 2.6-4.4 6-9 6s-8-3.4-9-6c1-2.6 4.4-6 9-6zm0 2.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"/>',
  trash: '<path d="M7 1h6v2h5v2.4H2V3h5z"/><path fill-rule="evenodd" d="M3.4 7h13.2L15.6 19H4.4zm3.6 2.5V16h2V9.5zm4 0V16h2V9.5z"/>',
  plus: '<path d="M8.8 2h2.4v6.8H18v2.4h-6.8V18H8.8v-6.8H2V8.8h6.8z"/>',
  "sign-out": '<path d="M2 2h9v4H8.8V4.2H4.2v11.6h4.6V14H11v4H2z"/><path d="M14 5.5l5 4.5-5 4.5v-3.3H7V8.8h7z"/>'
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
