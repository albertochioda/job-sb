/**
 * profiles.photo_url può contenere sia un path relativo (formato attuale,
 * "{userId}/profile.ext") sia un URL pubblico completo legacy (formato
 * salvato quando il bucket "photos" era ancora pubblico, prima della
 * correzione privacy 2026-09-25) — stesso pattern già usato per
 * cvs.file_url in adapt/cv/route.ts. Normalizza sempre al path relativo,
 * l'unico formato che createSignedUrl() accetta.
 */
export function normalizePhotoPath(photoUrl: string): string | null {
  if (!photoUrl.startsWith("http")) return photoUrl;
  const match = photoUrl.match(/\/photos\/(.+?)(?:\?|$)/);
  return match ? match[1] : null;
}
