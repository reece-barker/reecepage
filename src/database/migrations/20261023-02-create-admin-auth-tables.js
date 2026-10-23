// Sign in for the admin. There is one person who can sign in, so no users table: a session is a random token in a
// cookie (only its hash is stored here) and the passkeys are the backup way in next to Sign in with SimpleLogin.
// The sign_in_attempts table holds the short lived state and nonce of a sign in that is under way.
import { DataTypes } from "sequelize";

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function up({ context: queryInterface }) {
  const options = { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" };

  await queryInterface.createTable("admin_sessions", {
    id_hash: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    method: { type: DataTypes.STRING(20), allowNull: false },
    user_agent: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    last_seen_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, options);
  await queryInterface.addIndex("admin_sessions", ["expires_at"], { name: "admin_sessions_expires_at" });

  await queryInterface.createTable("admin_passkeys", {
    credential_id: { type: DataTypes.STRING(255), primaryKey: true, allowNull: false },
    public_key: { type: DataTypes.TEXT, allowNull: false },
    counter: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    transports: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "" },
    name: { type: DataTypes.STRING(80), allowNull: false },
    backed_up: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    last_used_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, options);

  await queryInterface.createTable("sign_in_attempts", {
    state_hash: { type: DataTypes.STRING(64), primaryKey: true, allowNull: false },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    secret: { type: DataTypes.STRING(200), allowNull: false },
    return_to: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "/admin" },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false }
  }, options);
}

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("sign_in_attempts");
  await queryInterface.dropTable("admin_passkeys");
  await queryInterface.dropTable("admin_sessions");
}
