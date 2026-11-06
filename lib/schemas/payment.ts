import { z } from "zod";

// An order id as the payment modal and the transactions page send it.
export const paymentIdSchema = z.number().int().positive();

// What the modal sends is already upper-cased and may carry spaces; the database matches upper(btrim(code)) too, so
// this is the one place that decides what a usable code looks like (non-blank, bounded).
export const couponCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((code) => code.toUpperCase());

export type PaymentId = z.input<typeof paymentIdSchema>;
export type CouponCode = z.input<typeof couponCodeSchema>;
