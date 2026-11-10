/**
 * Web Push côté client.
 *
 * L'envoi réel est fait par la fonction `supabase/functions/notify` (serveur) :
 * le navigateur ne fait qu'enregistrer son abonnement, stocké dans
 * `push_subscriptions`. Sans clé VAPID configurée, l'app reste utilisable et
 * l'interface explique que les rappels serveur ne sont pas actifs.
 */

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushConfigured = Boolean(vapidPublicKey);

export const pushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function subscribeToPush(): Promise<PushSubscriptionJSON> {
  if (!pushSupported()) {
    throw new Error("Ton navigateur ne prend pas en charge les notifications push.");
  }
  if (!vapidPublicKey) {
    throw new Error(
      "Les rappels serveur ne sont pas configurés sur cette version : la clé publique VAPID manque."
    );
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications refusées. Tu peux changer ça dans les réglages du navigateur.');
  }
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));
  return subscription.toJSON() as PushSubscriptionJSON;
}
