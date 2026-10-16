import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

export const STAFF_COOKIE_NAME = "staff_session";

const secretKey = new TextEncoder().encode(env.BETTER_AUTH_SECRET);

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export interface StaffClaims {
  staffId: string;
  merchantId: string;
  nombre: string;
  rol: "staff";
}

export async function createStaffToken(claims: StaffClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secretKey);
}

export async function verifyStaffToken(
  token: string,
): Promise<StaffClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (payload.rol !== "staff" || !payload.staffId || !payload.merchantId) {
      return null;
    }
    return payload as unknown as StaffClaims;
  } catch {
    return null;
  }
}

export async function getAuthenticatedStaff(): Promise<StaffClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyStaffToken(token);
}
