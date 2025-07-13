import type { Express } from "express";

// register application routes on the provided Express app
export function registerRoutes(app: Express): void {
  // Example health check route. Additional API routes can be added here.
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
}
