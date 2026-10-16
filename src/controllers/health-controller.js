// /health says the Node process is up (for the process manager and uptime checks).
// /health/ready also checks the things the app depends on, so a load balancer can stop sending traffic when the
// database is gone. Neither leaks versions, hostnames or error messages.

/**
 * @param {{ database: ReturnType<import("../database/index.js").createDatabase>, logger: import("pino").Logger }} deps
 */
export function createHealthController({ database, logger }) {
  return {
    live(req, res) {
      res.set("Cache-Control", "no-store").json({ status: "ok" });
    },

    async ready(req, res) {
      const checks = { app: "ok", database: database ? "unknown" : "disabled" };
      if (database) {
        try {
          // Never let a stuck database hang the health check, 3 seconds is plenty for SELECT 1
          await Promise.race([
            database.ping(),
            new Promise((resolve, reject) => setTimeout(() => reject(new Error("timeout")), 3000).unref())
          ]);
          checks.database = "ok";
        } catch (error) {
          checks.database = "error";
          logger.warn({ err: { message: error.message } }, "readiness check failed");
        }
      }
      const healthy = Object.values(checks).every((value) => value === "ok" || value === "disabled");
      res.status(healthy ? 200 : 503).set("Cache-Control", "no-store").json({ status: healthy ? "ok" : "degraded", checks });
    }
  };
}
