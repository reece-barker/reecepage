// Development only sample data so the purge job and the contact:list script have something to show.
// Every row says DEV SEED in the name so nobody mistakes it for a real message. The seed script refuses to run in production
const ROWS = [
  { submission_id: "dev-seed-0001", name: "DEV SEED Ada Example", email: "ada@example.com", topic: "An internship or a job", message: "DEV SEED sample message, not a real person.", days_ago: 2 },
  { submission_id: "dev-seed-0002", name: "DEV SEED Old Example", email: "old@example.com", topic: "Something else", message: "DEV SEED sample older than the retention period, the purge job should delete it.", days_ago: 400 }
];

export async function up({ context: queryInterface }) {
  const now = Date.now();
  await queryInterface.bulkInsert("contact_messages", ROWS.map(({ days_ago: daysAgo, ...row }) => {
    const at = new Date(now - daysAgo * 86400000);
    return { ...row, ip_hash: null, notified_at: null, notification_error: null, created_at: at, updated_at: at };
  }));
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete("contact_messages", { submission_id: ROWS.map((row) => row.submission_id) });
}
