import {
  CONTACT_CHANNELS,
  DIRECTIONS,
  OFFICE_HOURS,
  ROUTES,
  SCHOOL,
  VISIT_CAMPUS,
} from '@/constants';
import { admissionImages, campusImages } from '@/constants/imagery';
import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, drift, lines, rise, unmask } from '@/lib/motion';
import { Icon } from '@/components/common/Icon';
import { CTASection, Figure, Mark, SectionHead, Sticker } from '@/components/editorial';
import './contact.css';

/* ==========================================================================
   CONTACT & VISIT - the simplest page on the site
   --------------------------------------------------------------------------
   The only page that exists for people who are not ready to apply yet, so it
   reads as an invitation rather than as a technical footer: the welcome comes
   before the phone numbers, and the map is a link rather than an embedded
   panel demanding attention.

   It is deliberately the least designed page here. Somebody arriving on it
   wants a number, an address and a time - and every editorial device between
   them and those three things is a device working against the page.
   ========================================================================== */

/* --------------------------------------------------------------------------
   The opening
   --------------------------------------------------------------------------
   Not a PageCover. This is the one page that does not open on a photograph:
   a person looking for a phone number should be able to see it in the first
   screen, and a full-bleed cover would put it below the fold.
   -------------------------------------------------------------------------- */

export function CoHello() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    const head = el.querySelector<HTMLElement>('.hello__title');
    if (head) lines(head, { trigger: el, start: 'top 90%' });
    draw(el, { trigger: el, delay: 0.55, start: 'top 90%' });
    rise(el.querySelectorAll<HTMLElement>('.hello__body > *'), {
      trigger: el,
      start: 'top 90%',
      delay: 0.3,
      stagger: 0.07,
    });
    unmask(el.querySelectorAll<HTMLElement>('.hello__fig'), {
      trigger: el,
      start: 'top 90%',
      from: 'bottom',
    });
    drift(el.querySelector('.hello__fig img'), 60, { trigger: el });
  }, []);

  return (
    <section ref={scope} className="hello">
      <div className="wrap hello__inner">
        <div className="hello__body">
          <Sticker tone="sun" tilt={-2.4}>
            Contact &amp; visit
          </Sticker>

          <h1 className="hello__title ed-hero">
            Come say <Mark kind="underline">hello.</Mark>
          </h1>

          <p className="lead hello__lead">
            Some decisions need a conversation first. Call, write, get directions, or book a
            morning and walk the campus while the lessons are running.
          </p>

          <div className="hello__quick">
            <a className="hello__phone" href={SCHOOL.phoneHref}>
              <Icon name="phone" size={18} />
              {SCHOOL.phone}
            </a>
            <a className="link" href={`mailto:${SCHOOL.email}`}>
              {SCHOOL.email}
              <Icon name="arrowUpRight" size={15} />
            </a>
          </div>
        </div>

        <Figure
          photo={admissionImages[1]}
          width={860}
          sizes="(max-width: 900px) 90vw, 42vw"
          shape="arch"
          ratio="portrait"
          eager
          className="hello__fig"
        />
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The channels
   --------------------------------------------------------------------------
   Four routes in, each with the thing a person actually needs to know before
   they use it: when it is answered, and how fast.
   -------------------------------------------------------------------------- */

export function CoChannels() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    rise(el.querySelectorAll<HTMLElement>('.chan'), { trigger: el, y: 20, stagger: 0.07 });
    rise(el.querySelectorAll<HTMLElement>('.hours__row'), {
      trigger: el.querySelector('.hours'),
      y: 14,
      stagger: 0.05,
    });
  }, []);

  return (
    <section ref={scope} className="section section--paper chan-sec" id="contact">
      <div className="wrap chan-sec__inner">
        <ul className="chan-sec__list">
          {CONTACT_CHANNELS.map((channel) => (
            <li key={channel.id}>
              <a className="chan" href={channel.href}>
                <span className="chan__icon" aria-hidden="true">
                  <Icon name={channel.icon} size={18} />
                </span>
                <span className="chan__label meta">{channel.label}</span>
                <span className="chan__value">{channel.value}</span>
                <span className="chan__detail">{channel.detail}</span>
                <Icon name="arrowUpRight" size={16} className="chan__go" />
              </a>
            </li>
          ))}
        </ul>

        <div className="hours">
          <h2 className="fn-h4 hours__title">Office hours</h2>
          <dl className="hours__list">
            {OFFICE_HOURS.map((slot) => (
              <div className="hours__row" key={slot.day}>
                <dt>{slot.day}</dt>
                <dd>{slot.hours}</dd>
              </div>
            ))}
          </dl>

          <address className="hours__addr">{SCHOOL.address}</address>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Directions
   --------------------------------------------------------------------------
   Three ways to arrive, written by somebody who has done it, plus one link out
   to a real map.

   THE MAP IS A LINK, NOT AN EMBED.

   An embedded map is 400kb of third-party JavaScript, a cookie banner, and a
   panel that swallows the page's scroll on a phone - to show a pin that the
   visitor is going to open in their own maps app anyway. The link goes
   straight there.
   -------------------------------------------------------------------------- */

export function CoDirections() {
  const scope = useGsapScope<HTMLElement>((_, el) => {
    rise(el.querySelectorAll<HTMLElement>('.route'), { trigger: el, y: 18, stagger: 0.07 });
    unmask(el.querySelectorAll<HTMLElement>('.dir__fig'), { trigger: el, from: 'bottom' });
  }, []);

  return (
    <section ref={scope} className="section dir" id="directions">
      <div className="wrap">
        <SectionHead
          sticker="Getting here"
          stickerTilt={2}
          title={
            <>
              Off Doodh Bowli Road, at <Mark>Kabutar Khana.</Mark>
            </>
          }
          lead={DIRECTIONS.address}
          className="dir__head"
        />

        <div className="dir__body">
          <ol className="dir__routes">
            {DIRECTIONS.routes.map((route, i) => (
              <li className="route" key={route.id}>
                <span className="route__num meta">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="fn-h4 route__title">{route.title}</h3>
                <p className="route__detail">{route.detail}</p>
              </li>
            ))}
          </ol>

          <div className="dir__map">
            <a
              className="dir__fig-link"
              href={DIRECTIONS.mapsHref}
              target="_blank"
              rel="noreferrer noopener"
              data-cursor="Open map"
            >
              <Figure
                photo={campusImages[7]}
                width={900}
                sizes="(max-width: 900px) 90vw, 42vw"
                shape="frame"
                ratio="landscape"
                hover
                className="dir__fig"
                decorative
              />
              <span className="dir__pin">
                <Icon name="pin" size={18} />
              </span>
            </a>

            <a
              className="btn btn-primary dir__cta"
              href={DIRECTIONS.mapsHref}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span className="btn__label">
                Open in Google Maps
                <Icon name="arrowUpRight" size={16} />
              </span>
            </a>

            <p className="dir__note meta">
              Visitor parking is inside the second gate. The first gate is student drop-off only
              between 7:40 and 8:15 am.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   The visit
   -------------------------------------------------------------------------- */

export function CoVisit() {
  return (
    <CTASection
      id="visit"
      sticker={VISIT_CAMPUS.eyebrow}
      title={
        <>
          Book a morning and walk the{' '}
          <Mark kind="underline">whole place.</Mark>
        </>
      }
      lead={VISIT_CAMPUS.lead}
      photo={campusImages[8]}
      actions={[
        { label: 'Call to book', href: SCHOOL.phoneHref, variant: 'sun' },
        { label: 'Start an enquiry', to: `${ROUTES.admissions}#enquiry`, variant: 'secondary' },
      ]}
      footnote={VISIT_CAMPUS.slots.join('  ·  ')}
    />
  );
}
