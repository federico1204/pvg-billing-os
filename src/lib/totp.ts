import * as OTPAuth from "otpauth";

export function createTOTP(secret: string) {
  return new OTPAuth.TOTP({
    issuer: "PVG Billing OS",
    label: "billing@puravidagrowth.com",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret.replace(/\s/g, "")),
  });
}

export function generateSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function validateTOTP(secret: string, token: string): boolean {
  try {
    const totp = createTOTP(secret);
    const delta = totp.validate({ token: token.replace(/\s/g, ""), window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}

export function getTOTPUri(secret: string): string {
  return createTOTP(secret).toString();
}
