import { defineContactMessage } from "./contact-message.js";
import { defineMediaItem } from "./media-item.js";
import { defineContentModels } from "./content.js";

/** Defines every model on the given Sequelize instance. There are no associations, the repositories join by hand */
export function defineModels(sequelize) {
  const ContactMessage = defineContactMessage(sequelize);
  const MediaItem = defineMediaItem(sequelize);
  return { ContactMessage, MediaItem, ...defineContentModels(sequelize) };
}
