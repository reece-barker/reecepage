// Paperwork: the letters, invoices and contracts made in the admin. data is the whole form as JSON, number is the
// document number (RP-I-2026-0001), unique so an invoice number can never be given out twice. Every save writes a
// revision, like the content tables, so an invoice that was sent can always be looked up as it was
import { DataTypes } from "sequelize";

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function up({ context: queryInterface }) {
  const dialect = queryInterface.sequelize.getDialect();
  const idType = dialect === "mysql" ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER;
  const longText = dialect === "mysql" ? DataTypes.TEXT("long") : DataTypes.TEXT;
  await queryInterface.createTable("paperwork", {
    id: { type: idType, autoIncrement: true, primaryKey: true },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    number: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    lang: { type: DataTypes.STRING(5), allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "draft" },
    data: { type: longText, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false }
  });
  await queryInterface.addIndex("paperwork", ["kind", "created_at"], { name: "paperwork_kind_created" });
  await queryInterface.createTable("paperwork_revisions", {
    id: { type: idType, autoIncrement: true, primaryKey: true },
    paperwork_id: { type: idType, allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false },
    data: { type: longText, allowNull: false },
    reason: { type: DataTypes.STRING(20), allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false }
  });
  await queryInterface.addIndex("paperwork_revisions", ["paperwork_id", "created_at"], { name: "paperwork_revisions_doc_created" });
}

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("paperwork_revisions");
  await queryInterface.dropTable("paperwork");
}
