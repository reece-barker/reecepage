import { defineContactMessage } from "./contact-message.js";
import { defineMediaItem } from "./media-item.js";

/** Defines every model on the given Sequelize instance. There are no associations between them yet */
export function defineModels(sequelize) {
  const ContactMessage = defineContactMessage(sequelize);
  const MediaItem = defineMediaItem(sequelize);
  return { ContactMessage, MediaItem };
}
