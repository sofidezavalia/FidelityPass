import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedMerchant } from "../../../../../lib/get-authenticated-merchant";
import { isStorageConfigured, uploadLogo } from "../../../../../lib/storage";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];

/**
 * POST /api/merchants/personalizar/upload
 * Sube el archivo de logo a Object Storage si las credenciales están configuradas.
 */
export async function POST(request: NextRequest) {
  const { errorResponse, merchant } = await getAuthenticatedMerchant();
  if (errorResponse || !merchant) {
    return errorResponse;
  }

  // Patrón integración dormida
  if (!isStorageConfigured()) {
    return NextResponse.json(
      {
        error: "El upload se habilita cuando se configure el almacenamiento",
      },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se seleccionó ningún archivo" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Formato no permitido. Solo se aceptan imágenes (PNG, JPEG, WebP, SVG).",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera el tamaño máximo permitido (2 MB)." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const logoUrl = await uploadLogo(buffer, file.type, file.name);

    return NextResponse.json({ logoUrl }, { status: 200 });
  } catch (err) {
    console.error("Error al subir logo:", err);
    return NextResponse.json(
      { error: "Error al procesar la subida del logo." },
      { status: 500 },
    );
  }
}
