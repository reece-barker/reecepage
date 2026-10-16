// Pictures and videos uploaded on /admin/media, shown on /media and used in articles. The files themselves live on
// disk in MEDIA_DIR (var/media by default), this table only holds what they are and how to show them
import { DataTypes } from "sequelize";

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function up({ context: queryInterface }) {
  const idType = queryInterface.sequelize.getDialect() === "mysql" ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER;
  await queryInterface.createTable(
    "media_items",
    {
      id: { type: idType, autoIncrement: true, primaryKey: true, allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      kind: { type: DataTypes.STRING(10), allowNull: false },
      title: { type: DataTypes.STRING(160), allowNull: false },
      alt: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
      caption: { type: DataTypes.TEXT, allowNull: true },
      credit: { type: DataTypes.TEXT, allowNull: true },
      file: { type: DataTypes.STRING(160), allowNull: false },
      mime: { type: DataTypes.STRING(60), allowNull: false },
      bytes: { type: DataTypes.BIGINT, allowNull: false },
      width: { type: DataTypes.INTEGER, allowNull: true },
      height: { type: DataTypes.INTEGER, allowNull: true },
      duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
      poster: { type: DataTypes.STRING(160), allowNull: true },
      captions: { type: DataTypes.STRING(160), allowNull: true },
      transcript: { type: DataTypes.TEXT, allowNull: true },
      featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false }
    },
    { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" }
  );
  await queryInterface.addIndex("media_items", ["published", "created_at"], { name: "media_items_published_created_at" });
}

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("media_items");
}
