import { createRouter, publicQuery } from "./middleware";
import { siteRouter } from "./routers/site";
import { bookingRouter } from "./routers/booking";
import { adminRouter } from "./routers/admin";
import { pwaRouter } from "./routers/pwa";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  site: siteRouter,
  booking: bookingRouter,
  admin: adminRouter,
  pwa: pwaRouter,
});

export type AppRouter = typeof appRouter;
