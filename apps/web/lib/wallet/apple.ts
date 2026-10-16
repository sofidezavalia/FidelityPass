import { colors } from "@fidelitypass/ui";
import { env } from "../env";

export class AppleWalletNoConfiguradoError extends Error {
  constructor(message = "Apple Wallet no está configurado todavía") {
    super(message);
    this.name = "AppleWalletNoConfiguradoError";
  }
}

export function isAppleWalletConfigured(): boolean {
  return Boolean(env.PASSES_PROVIDER_API_KEY);
}

export interface MerchantApplePassData {
  id: string;
  nombre: string;
}

export interface CustomerApplePassData {
  id: string;
  nombre: string;
}

export interface CreatedApplePassResult {
  downloadUrl: string;
  applePassId: string;
}

/**
 * Emite un pase para Apple Wallet mediante el servicio tercero de firmado (PassSlot o equivalente).
 *
 * TODO (Post-MVP): Con cuenta Apple Developer (USD 99/año), migrar de proveedor
 * tercerizado a firma propia (.pkpass firmado con certificado de Apple) +
 * webService propio de actualización + APNs directo.
 */
export async function createApplePass(
  merchant: MerchantApplePassData,
  customer: CustomerApplePassData,
  serialNumber: string,
): Promise<CreatedApplePassResult> {
  if (!isAppleWalletConfigured()) {
    throw new AppleWalletNoConfiguradoError();
  }

  const apiKey = env.PASSES_PROVIDER_API_KEY;
  if (!apiKey) {
    throw new AppleWalletNoConfiguradoError();
  }

  const baseUrl = env.PASSES_PROVIDER_BASE_URL || "https://api.passslot.com/v1";

  // Payload según especificación de Apple Wallet storeCard (tarjeta de fidelidad)
  const payload = {
    passTypeIdentifier: "pass.com.fidelitypass.loyalty",
    style: "storeCard",
    organizationName: merchant.nombre,
    description: `Tarjeta de fidelidad ${merchant.nombre}`,
    backgroundColor: colors.azulNoche,
    foregroundColor: colors.niebla,
    labelColor: colors.celesteBandera,
    barcodes: [
      {
        format: "PKBarcodeFormatQR",
        message: serialNumber,
        messageEncoding: "iso-8859-1",
        altText: serialNumber,
      },
    ],
    storeCard: {
      headerFields: [
        {
          key: "sellos",
          label: "SELLOS",
          value: "0",
        },
      ],
      primaryFields: [
        {
          key: "comercio",
          label: "COMERCIO",
          value: merchant.nombre,
        },
      ],
      secondaryFields: [
        {
          key: "titular",
          label: "TITULAR",
          value: customer.nombre,
        },
      ],
      backFields: [
        {
          key: "info",
          label: "PROGRAMA DE FIDELIDAD",
          value: `Tarjeta emitida para ${customer.nombre} por ${merchant.nombre}. Presentá este código en cada visita para sumar sellos.`,
        },
        {
          key: "serial",
          label: "NÚMERO DE SERIE",
          value: serialNumber,
        },
      ],
    },
  };

  const response = await fetch(`${baseUrl}/passes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error del proveedor de Apple Wallet (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    id?: string;
    passId?: string;
    serialNumber?: string;
    downloadUrl?: string;
    url?: string;
  };

  const applePassId =
    data.id || data.passId || data.serialNumber || serialNumber;
  const downloadUrl =
    data.downloadUrl || data.url || `${baseUrl}/passes/${applePassId}/download`;

  return {
    downloadUrl,
    applePassId,
  };
}

/**
 * Actualiza el contador de sellos en Apple Wallet llamando al proveedor tercero,
 * quien despacha el push vía APNs al iPhone del cliente.
 */
export async function updateApplePassStamps(
  applePassId: string,
  sellos: number,
): Promise<void> {
  if (!isAppleWalletConfigured() || !applePassId) {
    return;
  }

  try {
    const apiKey = env.PASSES_PROVIDER_API_KEY;
    if (!apiKey) return;

    const baseUrl =
      env.PASSES_PROVIDER_BASE_URL || "https://api.passslot.com/v1";

    await fetch(
      `${baseUrl}/passes/${encodeURIComponent(applePassId)}/values/sellos`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({ value: String(sellos) }),
      },
    );
  } catch (err) {
    console.error("Error al actualizar sellos en Apple Wallet:", err);
  }
}
