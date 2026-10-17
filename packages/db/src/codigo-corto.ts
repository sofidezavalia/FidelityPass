import crypto from "node:crypto";

export const CODIGO_CORTO_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Genera un código corto de 6 caracteres alfanuméricos en mayúsculas sin caracteres ambiguos (sin 0, O, 1, I).
 * Ej. "K7X2PQ"
 */
export function generateCodigoCorto(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    const idx = crypto.randomInt(0, CODIGO_CORTO_ALPHABET.length);
    code += CODIGO_CORTO_ALPHABET[idx];
  }
  return code;
}
