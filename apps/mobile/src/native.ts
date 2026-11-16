/**
 * Native shell integration (Capacitor). Everything here is optional at
 * runtime: in a plain mobile browser the web fallbacks are used.
 */
import { Capacitor } from '@capacitor/core';
import { setDefaultServerUrl, setHapticsAdapter, type HapticKind } from '@plyo/core';

export const isNative = Capacitor.isNativePlatform();

export async function initNative() {
  // A server baked in at build time (VITE_PLYO_SERVER=wss://…/ws) for the store build.
  const baked = import.meta.env.VITE_PLYO_SERVER as string | undefined;
  if (baked) setDefaultServerUrl(baked);
  if (!isNative) return;

  const [{ Haptics, ImpactStyle, NotificationType }, { StatusBar, Style }, { ScreenOrientation }] = await Promise.all([
    import('@capacitor/haptics'),
    import('@capacitor/status-bar'),
    import('@capacitor/screen-orientation'),
  ]);
  setHapticsAdapter((kind: HapticKind) => {
    switch (kind) {
      case 'tap':
        void Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'select':
        void Haptics.selectionChanged();
        break;
      case 'heavy':
        void Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        void Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        void Haptics.notification({ type: NotificationType.Warning });
        break;
    }
  });
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await ScreenOrientation.lock({ orientation: 'portrait' });
  } catch {
    // Not every platform supports every call (e.g. orientation lock on some tablets).
  }
}
