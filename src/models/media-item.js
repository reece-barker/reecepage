import { DataTypes, Model } from "sequelize";

// A picture or a video in the media library. kind is "image" or "video", file is the name on disk in MEDIA_DIR
export const MEDIA_LIMITS = Object.freeze({ title: 160, alt: 300, caption: 2000, credit: 1000, transcript: 60000 });

/** @param {import("sequelize").Sequelize} sequelize */
export function defineMediaItem(sequelize) {
  class MediaItem extends Model {}
  MediaItem.init(
    {
      id: { type: sequelize.getDialect() === "mysql" ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      kind: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [["image", "video"]] } },
      title: { type: DataTypes.STRING(MEDIA_LIMITS.title), allowNull: false },
      alt: { type: DataTypes.STRING(MEDIA_LIMITS.alt), allowNull: false, defaultValue: "" },
      caption: { type: DataTypes.TEXT, allowNull: true },
      credit: { type: DataTypes.TEXT, allowNull: true },
      file: { type: DataTypes.STRING(160), allowNull: false },
      mime: { type: DataTypes.STRING(60), allowNull: false },
      bytes: { type: DataTypes.BIGINT, allowNull: false },
      width: { type: DataTypes.INTEGER, allowNull: true },
      height: { type: DataTypes.INTEGER, allowNull: true },
      durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
      poster: { type: DataTypes.STRING(160), allowNull: true },
      captions: { type: DataTypes.STRING(160), allowNull: true },
      transcript: { type: DataTypes.TEXT, allowNull: true },
      featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    { sequelize, modelName: "MediaItem", tableName: "media_items" }
  );
  return MediaItem;
}
