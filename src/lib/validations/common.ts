import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().trim().min(1, "ID inválido."),
});

export const bingoNumberSchema = z.coerce
  .number()
  .int("Número inválido.")
  .min(1, "Número inválido. Debe estar entre 1 y 75.")
  .max(75, "Número inválido. Debe estar entre 1 y 75.");

const gridCellSchema = z.union([z.null(), bingoNumberSchema]);

export const bingoGridSchema = z
  .array(z.array(gridCellSchema).length(5, "Cada fila debe tener 5 columnas."))
  .length(5, "La grilla debe tener 5 filas.")
  .superRefine((grid, context) => {
    if (grid[2]?.[2] !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La celda central debe ser null.",
        path: [2, 2],
      });
    }
  });
