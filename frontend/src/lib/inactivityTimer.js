let _timeoutId = /** @type {number | null} */ (null);
let _initialized = false;

// Durée d'inactivité avant oubli de la clé (en ms). Exemple : 30 minutes.
const INACTIVITY_MS = 30 * 60 * 1000;

const EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'visibilitychange'];

/** @param {() => void} onTimeout */
export function startInactivityTimer(onTimeout) {
  if (typeof window === 'undefined') return;

  const reset = () => {
    if (_timeoutId != null) {
      window.clearTimeout(_timeoutId);
    }
    _timeoutId = window.setTimeout(() => {
      _timeoutId = null;
      onTimeout();
    }, INACTIVITY_MS);
  };

  if (!_initialized) {
    const handler = () => {
      if (document.visibilityState === 'hidden') return;
      reset();
    };
    EVENTS.forEach((evt) => window.addEventListener(evt, handler));
    _initialized = true;
  }

  reset();
}

export function stopInactivityTimer() {
  if (typeof window === 'undefined') return;
  if (_timeoutId != null) {
    window.clearTimeout(_timeoutId);
    _timeoutId = null;
  }
}

