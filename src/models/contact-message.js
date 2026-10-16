import { DataTypes, Model } from "sequelize";

// A message someone sent through the contact form. Its the only personal data the site keeps, so its kept small:
// no raw ip address (only a salted hash for spotting abuse) and its deleted after contact.retention_days
export class ContactMessage extends Model {}

export const CONTACT_LIMITS = Object.freeze({ name: 120, email: 254, topic: 80, message: 5000 });

/** @param {import("sequelize").Sequelize} sequelize */
export function defineContactMessage(sequelize) {
  ContactMessage.init(
    {
      // UNSIGNED only exists on MySQL, SQLite (tests) gets a plain integer so Sequelize doesnt warn about it
      id: { type: sequelize.getDialect() === "mysql" ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      // The random id printed into the form, stops a double click or a refresh from saving the message twice
      submissionId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(CONTACT_LIMITS.name), allowNull: false, validate: { notEmpty: true } },
      email: { type: DataTypes.STRING(CONTACT_LIMITS.email), allowNull: false, validate: { isEmail: true } },
      topic: { type: DataTypes.STRING(CONTACT_LIMITS.topic), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, CONTACT_LIMITS.message] } },
      ipHash: { type: DataTypes.STRING(64), allowNull: true },
      notifiedAt: { type: DataTypes.DATE, allowNull: true },
      notificationError: { type: DataTypes.STRING(255), allowNull: true }
    },
    {
      sequelize,
      modelName: "ContactMessage",
      tableName: "contact_messages",
      indexes: [{ fields: ["created_at"] }, { fields: ["ip_hash", "created_at"] }]
    }
  );
  return ContactMessage;
}
