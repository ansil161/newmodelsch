import { ADMISSIONS_INTRO, KEY_DATES, SCHOOL } from '@/constants';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { reduced, settle } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import { useSmoothScroll } from '@/providers/SmoothScrollProvider';
import './admissions-cover.css';

/* ==========================================================================
   THE ADMISSIONS COVER - "the next chapter"
   --------------------------------------------------------------------------
   One idea, drawn at full size: the word CHAPTER is set as large as the page
   allows, and two of the school's students stand in front of it, on the
   ground of facts a parent needs before they apply.

   THREE DEPTHS, AND THE MOTION IS WHAT MAKES THEM READ AS DEPTH.

     back     the giant word, the baseline rule behind it
     middle   the students
     front    the fact cards, the copy, the call to action, the seal

   On load the letters stand up out of their baseline one by one and the
   students rise into place in front of them. After that, scrolling and the
   pointer move each layer at its own rate - the word drifts away sideways,
   the students come forward - so the cover keeps feeling dimensional without
   anything looping for attention. The one continuous motion is the seal's
   slow turn, and it stops for anyone who has asked for less movement.

   THE FACTS ARE PINNED TO THE STUDENTS.

   The four figures that answer "can I still apply, and for what" are cards
   placed around the two figures, each at its own depth: they arrive after the
   students, bob gently out of step with one another, and drift against the
   pointer at different rates. On a phone they drop into a staggered pair of
   rows over the students' feet.
   ========================================================================== */

const STUDENTS = {
  src: '/images/home/hero/students-pair.webp',
  w: 892,
  h: 609,
  alt: 'Two New Model High School students in uniform, one with a backpack and one holding books',
};

const WORD = 'chapter.';

const deadline = KEY_DATES.find((entry) => entry.id === 'k4');
const fact = (label) => ADMISSIONS_INTRO.quickFacts.find((item) => item.label === label);

/* Four figures, all published elsewhere on the page, pinned around the
   students as cards. The deadline leads, and is the one card in the brand
   ink, because it is the only figure with a consequence for missing it.

   `spot` names the card's place around the figures (see the CSS); `depth` is
   how far, and which way, it drifts with the pointer - mixed signs, so the
   cards separate from each other as well as from the students. */
const FACTS = [
  deadline && { label: deadline.title, value: deadline.date, icon: 'calendar', spot: 'deadline', depth: 1.5 },
  { ...fact('Entry classes'), icon: 'cap', spot: 'classes', depth: -1.1 },
  { ...fact('Board'), icon: 'book', spot: 'board', depth: 0.8 },
  { ...fact('Enquiry to confirmation'), icon: 'clock', spot: 'weeks', depth: -1.6 },
]
  .filter((item) => item?.value)
  .map((item) => ({ ...item, value: item.value.replace(' - ', '–') }));

const SESSION = ADMISSIONS_INTRO.session.replace('-', '–');

/* The seal's ring. Repeated so the text closes the circle evenly. */
const SEAL_TEXT = `The six steps · Admissions ${SESSION} · `;

export function AdCover() {
  const { scrollTo } = useSmoothScroll();

  const jump = (target) => (event) => {
    event.preventDefault();
    scrollTo(target, -80);
  };

  const scope = useGsapScope((_, el) => {
    const cta = el.querySelector('.adc__cta');
    const releaseMagnet = cta ? settle(cta, 0.28) : undefined;

    if (reduced()) return releaseMagnet;

    const q = gsap.utils.selector(el);
    const desktop = window.matchMedia('(min-width: 900px)').matches;

    /* ------------------------------------------------ the entrance */
    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'expo.out' } });

    tl.from(q('.adc__top > *'), { y: 14, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0)
      .from(q('.adc__lede-word > span'), { yPercent: 110, duration: 1.1, stagger: 0.06 }, 0.1)
      .from(
        q('.adc__char > span'),
        {
          yPercent: 105,
          rotate: 8,
          transformOrigin: '0% 100%',
          duration: 1.4,
          stagger: 0.055,
        },
        0.3,
      )
      .from(q('.adc__baseline'), { scaleX: 0, transformOrigin: '0% 50%', duration: 1.6, ease: 'power3.inOut' }, 0.3)
      .from(
        q('.adc__people img'),
        { yPercent: 22, autoAlpha: 0, scale: 0.94, transformOrigin: '50% 100%', duration: 1.5 },
        0.75,
      )
      .from(q('.adc__intro > *'), { y: 22, autoAlpha: 0, duration: 1, stagger: 0.09 }, 0.95)
      .from(q('.adc__seal'), { scale: 0.4, rotate: -120, autoAlpha: 0, duration: 1.4 }, 1.05)
      .from(
        q('.adc__card'),
        {
          autoAlpha: 0,
          scale: 0.6,
          yPercent: 40,
          rotation: (i) => (i % 2 ? 14 : -14),
          duration: 1.2,
          ease: 'back.out(1.6)',
          stagger: { each: 0.12, from: 'random' },
        },
        1.15,
      );

    const release = onStage(() => tl.play());

    /* ------------------------------------------------ depth on scroll */
    const depth = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });

    depth
      .to(q('.adc__giant'), { xPercent: desktop ? -9 : -14, yPercent: 16 }, 0)
      .to(q('.adc__people'), { yPercent: desktop ? -8 : -4 }, 0)
      .to(q('.adc__lede'), { yPercent: -30, autoAlpha: 0.2 }, 0)
      .to(q('.adc__seal-turn'), { rotate: 220 }, 0);

    /* ------------------------------------------------ depth on the pointer */
    let detachPointer;
    if (desktop && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const tween = (target, prop) =>
        gsap.quickTo(target, prop, { duration: 1.1, ease: 'power3.out' });

      const wordX = tween(q('.adc__giant-float'), 'x');
      const wordY = tween(q('.adc__giant-float'), 'y');
      const kidsX = tween(q('.adc__people-float'), 'x');
      const kidsY = tween(q('.adc__people-float'), 'y');
      const sealX = tween(q('.adc__seal-float'), 'x');
      const sealY = tween(q('.adc__seal-float'), 'y');
      const cards = q('.adc__card').map((card) => ({
        depth: Number(card.dataset.depth) || 1,
        x: tween(card, 'x'),
        y: tween(card, 'y'),
      }));

      const onMove = (event) => {
        const box = el.getBoundingClientRect();
        const nx = (event.clientX - box.left) / box.width - 0.5;
        const ny = (event.clientY - box.top) / box.height - 0.5;
        wordX(nx * -34);
        wordY(ny * -16);
        kidsX(nx * 22);
        kidsY(ny * 10);
        sealX(nx * 40);
        sealY(ny * 24);
        cards.forEach((card) => {
          card.x(nx * 30 * card.depth);
          card.y(ny * 18 * card.depth);
        });
      };

      const onLeave = () => {
        [wordX, wordY, kidsX, kidsY, sealX, sealY].forEach((set) => set(0));
        cards.forEach((card) => {
          card.x(0);
          card.y(0);
        });
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      detachPointer = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
      };
    }

    return () => {
      release();
      tl.kill();
      detachPointer?.();
      releaseMagnet?.();
    };
  }, []);

  return (
    <section ref={scope} className="adc" aria-labelledby="adc-title">
      <div className="adc__stage">
        <div className="adc__inner">
          <div className="adc__top">
            <p className="adc__context">
              <span>Admissions {SESSION}</span>
              <span className="adc__status">
                <span className="adc__pulse" aria-hidden="true" />
                <span className="sr-only">, applications </span>
                {ADMISSIONS_INTRO.status}
              </span>
            </p>
            <p className="adc__place">
              <span>{SCHOOL.locality}</span>
              <span>Since {SCHOOL.established}</span>
            </p>
          </div>

          <div className="adc__scene">
            <h1 className="adc__title" id="adc-title">
              <span className="sr-only">Your child&rsquo;s next chapter.</span>

              <span className="adc__lede" aria-hidden="true">
                {['Your', 'child’s', 'next'].map((word) => (
                  <span className="adc__lede-word" key={word}>
                    <span>{word}</span>
                  </span>
                ))}
              </span>

              <span className="adc__giant" aria-hidden="true">
                <span className="adc__giant-float">
                  <span className="adc__giant-mask">
                    {WORD.split('').map((char, index) => (
                      <span className="adc__char" key={`${char}-${index}`}>
                        <span>{char}</span>
                      </span>
                    ))}
                  </span>
                  <span className="adc__baseline" />
                </span>
              </span>
            </h1>

            <div className="adc__people">
              <div className="adc__people-float">
                <img
                  src={STUDENTS.src}
                  width={STUDENTS.w}
                  height={STUDENTS.h}
                  alt={STUDENTS.alt}
                  loading="eager"
                  decoding="async"
                  // @ts-expect-error -- fetchPriority landed in React 19 typings late
                  fetchpriority="high"
                />
              </div>

              <a className="adc__seal" href="#process" onClick={jump('#process')} aria-label="See the six steps">
                <span className="adc__seal-float">
                  <span className="adc__seal-turn">
                    <svg className="adc__seal-ring" viewBox="0 0 160 160" aria-hidden="true">
                      <defs>
                        <path id="adc-seal-path" d="M80,80 m-62,0 a62,62 0 1,1 124,0 a62,62 0 1,1 -124,0" />
                      </defs>
                      <text>
                        <textPath href="#adc-seal-path" textLength="389">
                          {SEAL_TEXT.repeat(2)}
                        </textPath>
                      </text>
                    </svg>
                  </span>
                  <span className="adc__seal-core" aria-hidden="true">
                    <Icon name="arrowDown" size={22} />
                  </span>
                </span>
              </a>

              <ul className="adc__cards" aria-label={`Admissions ${SESSION} at a glance`}>
                {FACTS.map((item) => (
                  <li
                    className={`adc__card adc__card--${item.spot}`}
                    data-depth={item.depth}
                    key={item.label}
                  >
                    <div className="adc__card-bob">
                      <div className="adc__card-body">
                        <span className="adc__card-icon" aria-hidden="true">
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span className="adc__card-text">
                          <span className="adc__card-label">{item.label}</span>
                          <strong className="adc__card-value">{item.value}</strong>
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="adc__intro">
              <p className="adc__summary">{ADMISSIONS_INTRO.summary}</p>

              <div className="adc__actions">
                <a className="btn btn-primary adc__cta" href="#enquiry" onClick={jump('#enquiry')}>
                  <span className="btn__label">
                    Enquire now
                    <Icon name="arrowRight" size={16} />
                  </span>
                </a>
                <a className="adc__call" href={SCHOOL.phoneHref}>
                  <Icon name="phone" size={15} />
                  <span>{SCHOOL.phone}</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
