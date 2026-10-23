// The content tables for the admin. Posts, pages, projects, tools and the legal pages are entries, the lists
// (timeline, skills, cv, references, now, branches) and the settings, menus and home page texts are documents.
// Every save also writes a revision so anything can be rolled back from the admin.
// The Markdown files in content/ are still the starting point, they get imported the first time the app starts
// with empty tables, and published content is mirrored back to them on GitHub.
import { DataTypes } from "sequelize";

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function up({ context: queryInterface }) {
  const mysql = queryInterface.sequelize.getDialect() === "mysql";
  const idType = mysql ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER;
  const options = { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" };
  const longText = mysql ? DataTypes.TEXT("long") : DataTypes.TEXT;

  await queryInterface.createTable("entries", {
    id: { type: idType, autoIncrement: true, primaryKey: true, allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "draft" },
    publish_at: { type: DataTypes.DATE, allowNull: true },
    meta: { type: longText, allowNull: false },
    body: { type: longText, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false }
  }, options);
  await queryInterface.addIndex("entries", ["type", "slug"], { name: "entries_type_slug", unique: true });
  await queryInterface.addIndex("entries", ["type", "status", "publish_at"], { name: "entries_type_status_publish_at" });

  await queryInterface.createTable("entry_revisions", {
    id: { type: idType, autoIncrement: true, primaryKey: true, allowNull: false },
    entry_id: { type: idType, allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false },
    publish_at: { type: DataTypes.DATE, allowNull: true },
    meta: { type: longText, allowNull: false },
    body: { type: longText, allowNull: false },
    reason: { type: DataTypes.STRING(20), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, options);
  await queryInterface.addIndex("entry_revisions", ["entry_id", "created_at"], { name: "entry_revisions_entry_created" });

  await queryInterface.createTable("documents", {
    name: { type: DataTypes.STRING(40), primaryKey: true, allowNull: false },
    data: { type: longText, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false }
  }, options);

  await queryInterface.createTable("document_revisions", {
    id: { type: idType, autoIncrement: true, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING(40), allowNull: false },
    data: { type: longText, allowNull: false },
    reason: { type: DataTypes.STRING(20), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, options);
  await queryInterface.addIndex("document_revisions", ["name", "created_at"], { name: "document_revisions_name_created" });
}

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("document_revisions");
  await queryInterface.dropTable("documents");
  await queryInterface.dropTable("entry_revisions");
  await queryInterface.dropTable("entries");
}
