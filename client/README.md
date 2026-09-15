# New Model High School — website

A six-page, scroll-driven site for New Model High School, Hyderabad (est. 1962).
React 19 + Vite + TypeScript, with React Router for pages, GSAP/ScrollTrigger for
motion and Lenis for smooth scrolling.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  →  dist/
npm run preview
```

## The design

**The New Model School brand.** The official horizontal logo
(`public/brand/`, used unmodified through `components/common/Logo.tsx`) is the
anchor, and the whole palette is derived from its one ink. All tokens live in
`src/styles/variables.css`; components use the semantic `--color-*` layer.

| | |
| --- | --- |
| Primary | Logo indigo-blue `#463595` — buttons, links, active states (9.5:1 on white) |
| Navy | `#1a1640` — headings and strong type; the footer ground (white logo) |
| Light | `#f6f5fb` / `#eceaf6` — selected supporting sections, fills, highlights |
| Canvas | White `#ffffff` — almost every section |
| Neutral | `#17161d` headings, `#2c2b35` secondary headings, `#5b5a66` body, `#737280` muted |
| Headings | **Geist** 600 (700 reserved for key figures) |
| Text | **Inter** 400–600 for body, navigation, forms, buttons and figures |

Two families, weights 400 / 500 / 600 / 700 only, loaded in one request.

Four decisions do most of the visual work, and each is defined once:

- **The sticker** (`globals.css`) — the section label, as a rotated paper tag
  with cut corners rather than an uppercase eyebrow behind a rule.
- **The marks** (`Mark` in `components/editorial/primitives.tsx`) — a
  highlighter sweep, a hand-drawn underline, or a drawn ring around one word in
  a headline. All three are background images on **inline** elements, so they
  wrap with the type; all three rest at their drawn state and are animated by a
  single `--mark-scale` custom property.
- **The shapes** (`variables.css`) — arch for people, organic squircle for
  candid photography, plain radius for places, circle for thumbnails. The
  squircle is absolute lengths with unequal corners, not percentages: once every
  percentage radius passes about 35% the corners meet and you get a plain oval.
- **The figure** (`components/editorial/Figure.tsx`) — every photograph goes
  through it, so the crop focus, the `srcset`, the reserved aspect ratio and the
  loading strategy are decided once rather than two hundred times.

## Structure

```
src/
  app/            Router (App.tsx), route table (routes.tsx), shared chrome
                  (Shell.tsx) and entry point (main.tsx)
  pages/          One module per route — each is a list of sections and nothing
                  else
  components/
    editorial/    THE KIT. Every page is composed out of these; editorial.css
                  is the one stylesheet for all of them
    common/       Icon (the whole sprite) and CustomCursor
    layout/       Preloader, Navbar, Footer, RouteTransition, PageFallback
    home/  about/  academics/  life/  admissions/  contact/
                  One `sections.tsx` + one stylesheet per page. The stylesheet
                  positions things; it never redefines a colour, a size or a
                  curve
  config/         env.ts — the only module that reads import.meta.env
  constants/      All copy and section data, plus imagery.ts — the one place a
                  photograph is named
  hooks/          useGsapScope, useMediaQuery, useIsomorphicLayoutEffect,
                  usePageMeta
  lib/            gsap.ts (single plugin registration), motion.ts (the whole
                  animation vocabulary), storage.ts
  providers/      SmoothScrollProvider (Lenis ↔ ScrollTrigger), AppProviders
  styles/         variables.css (design tokens), globals.css (reset + primitives)
  types/          Shared domain types
  utils/          format.ts, validation.ts
```

## The kit

`components/editorial` is the whole component system. A section that needs
something none of these do either wants a new member of the kit — added there,
documented, reusable — or wants rethinking.

| Component | What it is |
| --- | --- |
| `EditorialHero` | The homepage opening: oversized type, one large frame, figures floating on its foot |
| `PageCover` | An interior page's opening: one photograph with the chapter named across its foot and a rule of facts under it |
| `SectionHead` | Sticker → serif statement → mark → lead, on one choreography |
| `StickyStory` | A chapter that holds one photograph while the reader scrolls its panels |
| `EditorialTimeline` | History on a horizontal axis the reader's scroll drives |
| `HorizontalGallery` | The photo wall — dragged, wheeled, or arrow-keyed |
| `AchievementArchive` | The record, as a filterable ruled ledger |
| `JourneyPath` | A hand-drawn line the reader extends, with the stages hung off it |
| `ChapterRail` | The running index in the left margin |
| `QuoteSection` | One testimonial at display scale, advanced by hand |
| `EditorialAccordion` | The FAQ, as typography |
| `StatReveal` | Figures that count up to the number already in the markup |
| `PhotoBreak` | The pause between two dense sections — three frames, three speeds, nothing to read |
| `CTASection` | The ask, and nothing else |
| `Figure` `Mark` `Sticker` `Ed` `Meta` `Numeral` `Rule` | The primitives |

One thing deliberately *not* in the kit is the curriculum spread. It lives at
`components/academics/CurriculumChapters.tsx`, next to the only page that has
one, because a component used once is not reusable — it is just a component,
and filing it here would only imply the next page could have one too. See
below.

## Motion

`lib/motion.ts` holds the site's entire animation vocabulary — nine gestures:
`lines`, `rise`, `unmask`, `drift`, `count`, `draw`, `grow`, `rail`, `settle`.
Three rules apply to all of them:

1. **The resting state is the finished state.** Every helper animates *from* a
   hidden state it sets itself. Nothing is hidden in CSS, so a page with
   JavaScript disabled, a page that errors before hydration and a page printed
   to PDF are all complete pages.
2. **Reduced motion is not "faster", it is "already there".** Every helper
   checks the query and returns without building anything — never a 1ms version,
   because a 1ms version still pins, still scrubs and still hijacks a scroll.
3. **Transform and opacity only.** The exception is `unmask`, which animates
   `clip-path` because no transform does what it does.

**One section on the whole site pins the viewport** — the heritage timeline on
About — and it does it because its horizontal axis means *time*. That is the
test a scroll hijack has to pass before it is allowed. Everything else that
looks pinned is `position: sticky`, which costs no spacer, never captures the
scroll, and degrades to a plain stacked column on a phone.

Home used to pin too, for the same section. It does not any more: a pin inserts
a spacer worth thousands of pixels, that spacer is rebuilt on every refresh, and
everything below it moves while it settles — which is what made anchors on this
page land in the wrong place and what stalled the renderer when the page was
scrolled through it programmatically. `components/home/HomeHeritage.tsx` is the
same content as an ordinary vertical sequence with scrubbed transforms on top:
no spacer, no captured scroll, and a reader who does not care about 1985 can
keep going.

## The curriculum spread

`/academics` opens its second chapter as a page from a school annual rather
than as a section of a website, and it is the one place on the site that runs
its own material: warmer paper, charcoal instead of navy-black, an aged mustard
instead of the site's yellow, and two faded process colours off a printed page.
Those five values are defined on `.curric` and nowhere else, so one section can
be a different material without the site acquiring five new global colours.

**Compositions are data, not stylesheets.** Every chapter is a list of frames,
and each frame carries where it sits, how wide it is, the angle it was pasted
down at, whether it is in colour or photocopied to grey, how far it drifts on
scroll, and whether it is taped or torn. The renderer is one loop. Re-art-
directing a chapter means moving numbers in `sections.tsx`, which is what art
direction should cost — and it is why the four chapters can have three, four,
five and three frames in genuinely different arrangements without four separate
layouts drifting apart.

Three rules hold across all four: exactly one `lead` frame, always in colour and
always the largest thing on the plate; everything behind it photocopied, so the
eye never has two colour photographs competing; and no two chapters putting the
lead in the same place.

**Nothing in it is a card.** The section has no `border-radius` above 2px
anywhere and no long thin horizontal rules — the two things that make a layout
read as software. Where something needs separating it gets a trim tick, a
registration cross, a strip of tape, or space. Frames have paper borders and
contact shadows rather than radii and elevation.

**The one place a resting state is hidden in CSS.** Everywhere else on the site
the natural DOM state is the finished state. Here, which chapter is showing is
the component's *state* rather than an entrance, so the stylesheet owns it: if
GSAP never runs — a backgrounded tab throttling rAF, reduced motion, a script
that failed — the alternative is all four paste-ups stacked on top of each
other, which is not a degraded experience but a broken one. The transition
writes inline styles that outrank those rules for its duration and clears them
afterwards.

It looks like a contents page and it behaves like a tablist: real `tab` and
`tabpanel` roles, arrow keys, Home and End, and the three chapters nobody is
reading held `inert`.

## Pages

The site is six experiences, one route each. Each page owns exactly one stage of
a parent's decision, and answers exactly one question:

| Stage | Route | Page | Question it answers |
| --- | --- | --- | --- |
| Discovery | `/` | Home | Is this school right for my child? |
| Trust | `/about` | About | Who are they, and can I trust them? |
| Evaluation | `/academics` | Academics | What will my child actually learn? |
| Experience | `/student-life` | Student Life | What will student life look like? |
| Decision | `/admissions` | Admissions | How do I enroll my child? |
| Action | `/contact` | Contact & Visit | How can I visit or contact the school? |

`/about-education`, `/campus-life` and `/people-achievements` are the previous
architecture's paths and redirect (see `LEGACY_ROUTES` in `constants/index.ts`),
so printed links and bookmarks still resolve. So do the in-page anchors —
`#story`, `#timeline`, `#vision`, `#principal`, `#faculty`, `#recognition`,
`#alumni`, `#how-we-teach`, `#curriculum`, `#future-skills`, `#achievements`,
`#academic-proof`, `#enquiry` — because another page links to several of them
and a bookmark outlives a redesign.

No section repeats another page's answer. Three rules follow, and each one used
to be broken:

- **Why Choose Us appears once**, on Home. Admissions goes straight to
  eligibility — a reader who reached that page has already been convinced.
- **There is no Gallery section anywhere.** Photographs sit inside the section
  they are evidence for.
- **No two adjacent sections share a shape.** That constraint does more work
  than any individual section on the homepage.

## Conventions

- **Motion lives in `useGsapScope`.** It wraps setup in a `gsap.context()` so
  every tween and ScrollTrigger reverts on unmount, and defers until webfonts
  have loaded, because SplitText measures line boxes.
- **A measure written in `ch` belongs on the element set in that type.** `ch`
  resolves against the font-size of the element carrying it, so `max-width: 20ch`
  on a body-size wrapper is about 200px and crushes the display heading inside
  it. This was a real bug; see the note on `.sec-head`.
- **A highlighter or underline must be `inline`.** An absolutely-positioned
  pseudo-element on an inline box only covers the first line fragment, and the
  usual `white-space: nowrap` fix pushes a marked phrase out of its own column.
- **Never call `window.scrollTo`.** Lenis owns the scroll position; use
  `useSmoothScroll().scrollTo`. A native jump leaves Lenis and ScrollTrigger
  holding a stale value, which strands one-shot reveals in their from-state.
- **Never put a clipping `overflow` on a section containing a sticky child.**
  It becomes the sticky containing block and the pin silently stops working.
- **Snap containers need `scroll-padding`.** Snapping ignores padding, so
  without it the first card in a horizontal strip lands flush against the edge
  of the screen instead of on the gutter.
- **Only `constants/` holds copy and imagery,** and everything re-exports
  through `@/constants` so imports never change when a module is split.

## Photography

Every image resolves through `constants/imagery.ts`. No component builds a URL
and no content module holds one, so replacing the placeholder library with the
school's own shoot is that one file: repoint `resolve()` at the school's CDN and
swap each entry's `id` for a filename. Nothing else changes — not a layout, not
an animation, not a page.

Entries are grouped by job rather than by page (`heroImage`, `heritageImages`,
`campusImages`, `studentImages`, `facultyImages`, `sportsImages`, `artsImages`,
`academicImages`, `admissionImages`, `galleryImages`), so a photograph used in
two places is one entry referenced twice.

Each entry carries a `focus` — an `object-position` value. This is load-bearing
rather than decorative: the site crops photography into arches, circles and
squircles, and a portrait cropped to a circle on its default centre loses the
face every time. **Check the crop on each replacement**, especially in
`facultyImages`.

The placeholders are Unsplash; every id in the file has been checked to resolve.

**The school film** is served straight out of `public/videos/school-film.mp4`,
so dropping the file in is the whole integration. Until it is there the About
page's film section says so in place, rather than failing silently.

## Deploying

The router is history-based, so the host must serve `index.html` for every path
or a direct hit on `/admissions` 404s. `public/_redirects` covers Netlify;
Vercel needs a `vercel.json` rewrite, nginx a `try_files $uri /index.html`, and
Apache an equivalent `.htaccess` rule. `vite preview` already does this.

## Content still to be confirmed

Some of this is information architecture rather than published fact, and the
site says so where it matters:

- **Curriculum.** `CURRICULUM_NOTE` is rendered under the curriculum map.
  Subject lists, stage descriptions and assessment patterns need school approval
  before launch.
- **People, results and achievements.** Every portrait, biography, figure and
  award on About and in the record on Academics is placeholder and must be
  replaced with verified school data. The rule for those sections is authentic
  content only: no invented testimonials, no inflated statistics.
- **News, events, notices and downloads.** Every array in `constants/news.ts` is
  the shape a CMS would return, so swapping the constants for a fetch changes no
  component. Nothing currently renders them.

Several constants are likewise carried but not rendered by the current design —
`EDUCATION_CARDS`, `CAMPUS_HERO`/`CAMPUS_PAIR`/`CAMPUS_WIDE`/`CAMPUS_TRIO`,
`VISION_PANELS`, `HERITAGE_FRAMES`, `JOURNEY_PLATE`, `FEATURES`, `GALLERY`,
`TRUST_BADGES` and `LEARNING_BANDS`. They are approved content that this
redesign expresses differently rather than data that was dropped, and they are
kept so the copy is not lost. Nothing imports them; treat them as an archive
rather than as a source of truth for what is on screen.

## Admissions form

Four validated steps, drafts kept in `localStorage` under `nmhs.admission.draft`.
Submission POSTs to `${VITE_API_BASE_URL}/admissions` when that variable is set;
with no API configured it resolves locally so the flow stays testable. The short
contact-page enquiry behaves the same way and says so on success.

## Sign-in

`/login` is the only authentication page — there is no registration route,
because accounts are issued by the school. A successful sign-in returns to the
protected page that sent the reader there, otherwise `/dashboard`, which is a
deliberately minimal placeholder for the school's real signed-in area.

| Piece | Where |
| --- | --- |
| API client (cookies, CSRF, single-flight refresh) | `lib/apiClient.ts` |
| Auth endpoints | `lib/authApi.ts` |
| Session state | `providers/AuthProvider.tsx`, `hooks/useAuth.ts` |
| Layout, guard, form, CAPTCHA | `components/auth/` |
| Pages | `pages/LoginPage.tsx`, `pages/DashboardPage.tsx` |

- **No token ever reaches JavaScript.** The backend sets HttpOnly cookies; every
  request is `credentials: 'include'`. Nothing is written to `localStorage` or
  `sessionStorage`.
- **Unsafe requests send `X-CSRFToken`**, fetched from `GET /api/v1/auth/csrf/`
  and held in memory.
- **A 401 triggers one refresh** shared by every failing request (and serialised
  across tabs with the Web Locks API), then each request retries once. If the
  refresh fails the session is cleared and protected routes redirect to `/login`.
- **The session is only checked on the sign-in routes.** `AuthProvider` lives in
  `AuthLayout`, so the six public pages make no auth requests.

In development, `npm run dev` proxies `/api` to the Django server
(`DEV_API_PROXY_TARGET`, default `http://127.0.0.1:8000`). In production, either
route `/api` to Django on the same host or set `VITE_API_BASE_URL` to the API's
versioned root (e.g. `https://api.example.com/api/v1`). If a Content Security
Policy is added to this site, allow the CAPTCHA provider's script and frame
origin (`https://challenges.cloudflare.com` for Turnstile).

## Not yet set up

`.eslintrc.cjs` and `.prettierrc` are empty placeholders from the original
scaffold and `eslint` is not a dependency, so `npm run lint` does not run.
