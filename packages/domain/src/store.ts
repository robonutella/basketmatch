import { z } from "zod";
import { EntityIdSchema } from "./shared.js";

export const StoreSchema = z.object({
  id: EntityIdSchema,
  retailerId: EntityIdSchema.optional(),
  name: z.string().trim().min(1),
  locationCode: z.string().trim().min(1).optional(),
  address: z.string().trim().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  distanceMiles: z.number().nonnegative().optional(),
  timezone: z.string().trim().min(1).optional()
});

export type Store = z.infer<typeof StoreSchema>;
