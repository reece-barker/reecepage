// Smaller copies of each picture (made in the browser when it is uploaded from the editor), so phones dont
// download a 4000 pixel photo to show it 400 pixels wide. A JSON list of { width, file }
import { DataTypes } from "sequelize";

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function up({ context: queryInterface }) {
  await queryInterface.addColumn("media_items", "variants", { type: DataTypes.TEXT, allowNull: true });
}

/** @param {{ context: import("sequelize").QueryInterface }} params */
export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn("media_items", "variants");
}
