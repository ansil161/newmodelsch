import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import type { CaptchaProvider } from '@/types/api';

/* ==========================================================================
   CAPTCHA
   --------------------------------------------------------------------------
   One component for the three providers the backend can verify: Cloudflare
   Turnstile, hCaptcha and reCAPTCHA v2. Their browser APIs have the same
   shape - render into an element, a callback with a token, reset, expiry and
   error callbacks - so a provider is a script URL and a few options.

   The token proves nothing by itself. It goes out with the login request and
   the backend checks it with the provider, using a secret this code never
   sees. A token is single-use: the form resets the widget after every
   attempt that did not sign in.
   ========================================================================== */

type WidgetId = string | number;

interface WidgetApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => WidgetId;
  reset: (id?: WidgetId) => void;
  remove?: (id: WidgetId) => void;
}

const PROVIDERS: Record<CaptchaProvider, { script: string; global: string; options: Record<string, unknown> }> = {
  turnstile: {
    script: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    global: 'turnstile',
    // 'flexible' fills the form's column instead of sitting at a fixed 300px,
    // and an expired token is replaced without the user having to act.
    options: { theme: 'light', size: 'flexible', action: 'login', 'refresh-expired': 'auto' },
  },
  hcaptcha: {
    script: 'https://js.hcaptcha.com/1/api.js?render=explicit',
    global: 'hcaptcha',
    options: { theme: 'light' },
  },
  recaptcha: {
    script: 'https://www.google.com/recaptcha/api.js?render=explicit',
    global: 'grecaptcha',
    options: { theme: 'light' },
  },
};

const LOAD_TIMEOUT_MS = 15_000;
const scripts = new Map<CaptchaProvider, Promise<WidgetApi>>();

/** Loads a provider's script once per page, resolving when its API is ready. */
function loadProvider(provider: CaptchaProvider): Promise<WidgetApi> {
  const cached = scripts.get(provider);
  if (cached) return cached;

  const { script, global } = PROVIDERS[provider];
  const globals = window as unknown as Record<string, unknown>;
  const readyCallback = `__nmhsCaptchaReady_${provider}`;

  const loading = new Promise<WidgetApi>((resolve, reject) => {
    const tag = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timer);
      delete globals[readyCallback];
      tag.remove();
      scripts.delete(provider); // a later mount may try again
      reject(new Error(`The ${provider} script did not load.`));
    };
    const timer = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    globals[readyCallback] = () => {
      window.clearTimeout(timer);
      delete globals[readyCallback];
      resolve(globals[global] as WidgetApi);
    };

    tag.src = `${script}&onload=${readyCallback}`;
    tag.async = true;
    tag.onerror = fail;
    document.head.appendChild(tag);
  });

  scripts.set(provider, loading);
  return loading;
}

export interface CaptchaHandle {
  /** Discard the current token and present a fresh challenge. */
  reset: () => void;
}

interface CaptchaProps {
  provider: CaptchaProvider;
  siteKey: string;
  /** id of the visible label naming this control. */
  labelledBy: string;
  onToken: (token: string | null) => void;
  onExpire: () => void;
  onError: (kind: 'load' | 'challenge') => void;
  ref?: Ref<CaptchaHandle>;
}

export function Captcha({ provider, siteKey, labelledBy, onToken, onExpire, onError, ref }: CaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ api: WidgetApi; id: WidgetId } | null>(null);
  const callbacks = useRef({ onToken, onExpire, onError });

  // The widget is rendered once; keep it calling the latest handlers.
  useEffect(() => {
    callbacks.current = { onToken, onExpire, onError };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // A fresh host element per render: reCAPTCHA refuses to render twice into
    // one element, and StrictMode runs this effect twice in development.
    const host = document.createElement('div');
    container.appendChild(host);
    let cancelled = false;

    loadProvider(provider).then(
      (widgetApi) => {
        if (cancelled) return;
        const expire = () => {
          callbacks.current.onToken(null);
          callbacks.current.onExpire();
        };
        const id = widgetApi.render(host, {
          ...PROVIDERS[provider].options,
          sitekey: siteKey,
          callback: (token: string) => callbacks.current.onToken(token),
          'expired-callback': expire,
          'error-callback': () => {
            callbacks.current.onToken(null);
            callbacks.current.onError('challenge');
          },
          ...(provider === 'turnstile' ? { 'timeout-callback': expire } : {}),
        });
        widgetRef.current = { api: widgetApi, id };
      },
      () => {
        if (!cancelled) callbacks.current.onError('load');
      },
    );

    return () => {
      cancelled = true;
      const widget = widgetRef.current;
      widgetRef.current = null;
      try {
        widget?.api.remove?.(widget.id);
      } catch {
        /* already gone */
      }
      host.remove();
    };
  }, [provider, siteKey]);

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        const widget = widgetRef.current;
        if (widget) widget.api.reset(widget.id);
      },
    }),
    [],
  );

  return <div ref={containerRef} className="auth-form__captcha" role="group" aria-labelledby={labelledBy} />;
}
