import "server-only";
import { getValidRealDebridAccessToken } from "@/features/real-debrid/server/connection";
import type { RealDebridCredential } from "../domain/torrentio/types.ts";

/**
 * Obtains a fresh, valid Real-Debrid credential in the Torrentio domain format
 * for the specified user, leveraging Daemon's automatic token refresh lifecycle.
 * Returns null if no connection exists or if the user is disconnected.
 */
export async function getTorrentioRealDebridCredential(
  userId: string
): Promise<RealDebridCredential | null> {
  const token = await getValidRealDebridAccessToken(userId);
  if (!token) {
    return null;
  }
  return {
    kind: "realdebrid",
    secret: token,
  };
}
