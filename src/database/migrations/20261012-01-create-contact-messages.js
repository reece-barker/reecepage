// Creates the table for contact form messages. Written with queryInterface so it runs on MySQL and on SQLite
import { DataTypes } from "sequelize";

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function up({ context: queryInterface }) {
  const idType = queryInterface.sequelize.getDialect() === "mysql" ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER;
  await queryInterface.createTable(
    "contact_messages",
    {
      id: { type: idType, autoIncrement: true, primaryKey: true, allowNull: false },
      submission_id: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(254), allowNull: false },
      topic: { type: DataTypes.STRING(80), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      ip_hash: { type: DataTypes.STRING(64), allowNull: true },
      notified_at: { type: DataTypes.DATE, allowNull: true },
      notification_error: { type: DataTypes.STRING(255), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false }
    },
    // utf8mb4 so emoji and every alphabet survive, ignored on SQLite
    { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
  );
  await queryInterface.addIndex("contact_messages", ["created_at"], { name: "contact_messages_created_at" });
  await queryInterface.addIndex("contact_messages", ["ip_hash", "created_at"], { name: "contact_messages_ip_hash_created_at" });
}

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("contact_messages");
}
