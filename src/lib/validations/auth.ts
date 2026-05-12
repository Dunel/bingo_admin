import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Email inválido.")
  .transform((value) => value.toLowerCase());

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Email y contraseña son obligatorios."),
});

export const registerBodySchema = z.object({
  email: emailSchema,
  username: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      const normalized = value.trim();
      return normalized ? normalized : null;
    })
    .refine((value) => value === null || value.length <= 80, "El username no puede superar 80 caracteres."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").max(200, "La contraseña es demasiado larga."),
});
