/**
 * The legacy image helper.
 *
 * Photography now resolves through `constants/imagery.ts`, which is the one
 * place a photograph is named and the only file that has to change when the
 * school's own shoot is delivered. This helper survives because the content
 * modules still carry an `image` field on several of their entries, and those
 * fields are still the right shape for a CMS to fill.
 *
 * Do not reach for this in new code. If a component needs a photograph, it
 * takes a `Photo` from `imagery.ts` and passes it to `Figure`, which is what
 * carries the crop focus, the srcset and the reserved aspect ratio.
 *
 * What used to live here as well: `HERO_STILLS`, a set of frames chosen for a
 * cross-fading hero that no longer exists, and `HERO_VIDEOS`, a pair of CC0
 * sample clips hosted by MDN standing in for the school's b-roll. Both were
 * dead once the heroes were rebuilt, and a list of third-party URLs nothing
 * renders is a thing someone eventually wires back up by mistake.
 */
export const img = (id: string, w = 1280) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
