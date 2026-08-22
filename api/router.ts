import { createRouter, publicQuery } from "./middleware";
import { siteRouter } from "./routers/site";
import { bookingRouter } from "./routers/booking";
import { adminRouter } from "./routers/admin";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  site: siteRouter,
  booking: bookingRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
