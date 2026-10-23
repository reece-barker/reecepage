import { DataTypes, Model } from "sequelize";

// The admin's tables, see the 20261023 migrations for what each one is for. meta and data are JSON kept as text,
// that works the same on MySQL and SQLite and the app always reads the whole thing anyway

/** @param {import("sequelize").Sequelize} sequelize */
export function defineContentModels(sequelize) {
  const idType = sequelize.getDialect() === "mysql" ? DataTypes.INTEGER.UNSIGNED : DataTypes.INTEGER;
  const longText = sequelize.getDialect() === "mysql" ? DataTypes.TEXT("long") : DataTypes.TEXT;

  class Entry extends Model {}
  Entry.init({
    id: { type: idType, autoIncrement: true, primaryKey: true },
    type: { type: DataTypes.STRING(20), allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: "draft" },
    publishAt: { type: DataTypes.DATE, allowNull: true },
    meta: { type: longText, allowNull: false },
    body: { type: longText, allowNull: false }
  }, { sequelize, modelName: "Entry", tableName: "entries" });

  class EntryRevision extends Model {}
  EntryRevision.init({
    id: { type: idType, autoIncrement: true, primaryKey: true },
    entryId: { type: idType, allowNull: false },
    slug: { type: DataTypes.STRING(120), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    status: { type: DataTypes.STRING(12), allowNull: false },
    publishAt: { type: DataTypes.DATE, allowNull: true },
    meta: { type: longText, allowNull: false },
    body: { type: longText, allowNull: false },
    reason: { type: DataTypes.STRING(20), allowNull: false }
  }, { sequelize, modelName: "EntryRevision", tableName: "entry_revisions", updatedAt: false });

  class Document extends Model {}
  Document.init({
    name: { type: DataTypes.STRING(40), primaryKey: true },
    data: { type: longText, allowNull: false }
  }, { sequelize, modelName: "Document", tableName: "documents" });

  class DocumentRevision extends Model {}
  DocumentRevision.init({
    id: { type: idType, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(40), allowNull: false },
    data: { type: longText, allowNull: false },
    reason: { type: DataTypes.STRING(20), allowNull: false }
  }, { sequelize, modelName: "DocumentRevision", tableName: "document_revisions", updatedAt: false });

  class AdminSession extends Model {}
  AdminSession.init({
    idHash: { type: DataTypes.STRING(64), primaryKey: true },
    method: { type: DataTypes.STRING(20), allowNull: false },
    userAgent: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false }
  }, { sequelize, modelName: "AdminSession", tableName: "admin_sessions", updatedAt: false });

  class AdminPasskey extends Model {}
  AdminPasskey.init({
    credentialId: { type: DataTypes.STRING(255), primaryKey: true },
    publicKey: { type: DataTypes.TEXT, allowNull: false },
    counter: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    transports: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    name: { type: DataTypes.STRING(80), allowNull: false },
    backedUp: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    lastUsedAt: { type: DataTypes.DATE, allowNull: true }
  }, { sequelize, modelName: "AdminPasskey", tableName: "admin_passkeys", updatedAt: false });

  class SignInAttempt extends Model {}
  SignInAttempt.init({
    stateHash: { type: DataTypes.STRING(64), primaryKey: true },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    secret: { type: DataTypes.STRING(200), allowNull: false },
    returnTo: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "/admin" },
    expiresAt: { type: DataTypes.DATE, allowNull: false }
  }, { sequelize, modelName: "SignInAttempt", tableName: "sign_in_attempts", updatedAt: false });

  return { Entry, EntryRevision, Document, DocumentRevision, AdminSession, AdminPasskey, SignInAttempt };
}
