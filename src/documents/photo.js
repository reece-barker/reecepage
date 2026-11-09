// The headshot on documents, its the same photo as on the CV page (assets/images/cv). Its always an option and off
// unless ticked, and never in the Word files (those stay plain) or on invoices and contracts.
import { esc } from "./format.js";

export const PHOTO = "images/cv/reece-barker.jpg";
// For email the photo is a ready made round png with see through corners, Outlook ignores border-radius so a css
// circle would come out square there. Lives in public/email next to the dove
export const PHOTO_EMAIL = "email/reece-barker-round-192.png";

/** The round photo for the printed documents, the shape and size come from the class in paperwork.scss */
export function photoTag(asset, className) {
  return `<img class="${className}" src="${esc(asset(PHOTO))}" alt="">`;
}
