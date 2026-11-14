/**
 * Camera access helpers: capability checks, rear-camera request and
 * human-readable error mapping.
 */

export class CameraError extends Error {
  constructor(code, title, message) {
    super(message);
    this.code = code;
    this.title = title;
  }
}

export function checkCameraSupport() {
  if (!window.isSecureContext) {
    return new CameraError(
      'insecure',
      'HTTPS required',
      'Browsers only allow camera access on secure (https://) pages. Open the deployed HTTPS link instead of a local IP address.'
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return new CameraError(
      'unsupported',
      'Camera not supported',
      'This browser cannot access the camera. Try the latest Chrome (Android) or Safari (iPhone), and avoid in-app browsers such as Instagram or Facebook.'
    );
  }
  return null;
}

export function mapCameraError(err) {
  if (err instanceof CameraError) return err;
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new CameraError(
      'denied',
      'Camera permission blocked',
      'Allow camera access for this site, then tap Retry. On iPhone: Settings › Safari › Camera. On Android Chrome: tap the lock icon in the address bar › Permissions › Camera.'
    );
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new CameraError('notfound', 'No camera found', 'We could not find a usable camera on this device.');
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return new CameraError(
      'busy',
      'Camera is busy',
      'Another app or browser tab is using the camera. Close it and tap Retry.'
    );
  }
  return new CameraError('unknown', 'Could not start the camera', err?.message || String(err));
}

/** Request the rear camera. Falls back to any camera (laptops) if needed. */
export async function openRearCamera() {
  const unsupported = checkCameraSupport();
  if (unsupported) throw unsupported;

  const attempts = [
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: true },
  ];
  let lastErr;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
      // Permission errors will not improve with looser constraints.
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') break;
    }
  }
  throw mapCameraError(lastErr);
}

export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}
