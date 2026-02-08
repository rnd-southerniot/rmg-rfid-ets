import { z } from 'zod';

export const MacSchema = z
  .string()
  .min(1)
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(s), 'Invalid MAC');

export const IsoTsSchema = z.string().datetime();

export const EventTypeSchema = z.enum(['COMPLETE', 'QC_PASS', 'QC_FAIL']);

export const RfidUidSchema = z.string().min(1).transform((s) => s.trim().toUpperCase());
