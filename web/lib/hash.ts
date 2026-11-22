export const DEMO_PASSWORD_HASH =
  "0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d";

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
