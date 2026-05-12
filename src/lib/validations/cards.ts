import { z } from "zod";
import { bingoGridSchema, bingoNumberSchema } from "@/lib/validations/common";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_MIMES = new Set(["image/jpg", "image/jpeg", "image/png"]);

export const createCardFormSchema = z.object({
  image: z
    .instanceof(File, { message: "Debes subir una imagen." })
    .refine((file) => VALID_MIMES.has(file.type), "Formato inválido. Usa jpg, jpeg o png.")
    .refine((file) => file.size <= MAX_FILE_SIZE, "La imagen excede 5 MB."),
  name: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      const normalized = value.trim();
      return normalized ? normalized.slice(0, 80) : null;
    }),
});

export const markNumberBodySchema = z.object({
  number: bingoNumberSchema,
});

const rawNumberSchema = z.union([z.number(), z.string(), z.null(), z.undefined()]);
const rawNumberListSchema = z.union([rawNumberSchema, z.array(rawNumberSchema)]).optional();

export const deleteMarkedNumbersBodySchema = z
  .object({
    number: rawNumberListSchema,
    numbers: rawNumberListSchema,
  })
  .transform((value) => {
    const source = value.numbers ?? value.number;
    const asArray = Array.isArray(source) ? source : [source];

    const numbers = asArray
      .flatMap((item) => {
        const parsed = bingoNumberSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
      .filter((item, index, array) => array.indexOf(item) === index)
      .sort((a, b) => a - b);

    return { numbers };
  })
  .refine((value) => value.numbers.length > 0, {
    message: "Debes enviar al menos un número válido entre 1 y 75.",
  });

export const cardGridPatchBodySchema = z.object({
  grid: bingoGridSchema,
});

const cropRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite(),
});

export const generateBodySchema = z
  .object({
    cropRect: cropRectSchema.optional(),
    cropRects: z.array(cropRectSchema).optional(),
    mode: z.enum(["single", "x4"]).optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "x4" && Array.isArray(value.cropRects) && value.cropRects.length !== 4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "En modo x4 debes enviar 4 rectángulos válidos.",
        path: ["cropRects"],
      });
    }
  });
