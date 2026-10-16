// All the database access for contact messages lives here so the service never builds queries itself
import { Op, UniqueConstraintError } from "sequelize";

export class ContactMessageRepository {
  /** @param {{ ContactMessage: typeof import("../models/contact-message.js").ContactMessage }} models */
  constructor(models) {
    this.ContactMessage = models.ContactMessage;
  }

  /**
   * Saves a message. A second save with the same submissionId is not an error, its someone pressing send twice,
   * so it returns the first one and says it was a duplicate.
   * @returns {Promise<{ message: object, duplicate: boolean }>}
   */
  async create(data) {
    try {
      const message = await this.ContactMessage.create(data);
      return { message, duplicate: false };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) throw error;
      const message = await this.ContactMessage.findOne({ where: { submissionId: data.submissionId } });
      return { message, duplicate: true };
    }
  }

  async markNotified(id, at = new Date()) {
    await this.ContactMessage.update({ notifiedAt: at, notificationError: null }, { where: { id } });
  }

  async markNotificationFailed(id, reason) {
    await this.ContactMessage.update({ notificationError: String(reason).slice(0, 255) }, { where: { id } });
  }

  /** Deletes everything older than the cutoff, returns how many rows went */
  async deleteOlderThan(cutoff) {
    return this.ContactMessage.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
  }

  async listRecent(limit = 20) {
    return this.ContactMessage.findAll({ order: [["createdAt", "DESC"]], limit, raw: true });
  }

  /** Messages that were saved but never reached the inbox, for the retry script */
  async listUnnotified(limit = 50) {
    return this.ContactMessage.findAll({ where: { notifiedAt: null }, order: [["createdAt", "ASC"]], limit });
  }
}
