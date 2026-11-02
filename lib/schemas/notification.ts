import { z } from "zod";

export const notificationIdSchema = z.number().int().positive();

export type NotificationId = z.input<typeof notificationIdSchema>;
