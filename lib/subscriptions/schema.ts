import { z } from "zod";
import { BILLING_CYCLE_VALUES } from "./cycle";

export const subscriptionInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  brand: z.string().trim().max(60).optional().or(z.literal("")),
  amount: z.coerce.number().min(0),
  currency: z.string().trim().length(3).toUpperCase(),
  billing_cycle: z.enum(BILLING_CYCLE_VALUES),
  anchor_day: z.coerce.number().int().min(1).max(31).optional(),
  account_id: z.string().uuid().optional().or(z.literal("")),
  category_id: z.string().uuid().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export type SubscriptionInput = z.infer<typeof subscriptionInput>;
