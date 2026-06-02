import type { TrackEvent } from './events';

export function track(event: TrackEvent): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event.name, event);
  }
  // Swap in a provider here, e.g.:
  // posthog.capture(event.name, event)
}
