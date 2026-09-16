import { Link } from 'react-router-dom';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { count, draw, drift, reduced, settle } from '@/lib/motion';
import { onStage, stageOpen } from '@/lib/stage';
import { Icon } from '@/components/common/Icon';
import { Figure } from './Figure';
import { Sticker } from './primitives';

export function EditorialHero({
  sticker,
  title,
  lead,
  question,
  photo,
  inset,
  figures = [],
  actions = [],
  cue = 'Scroll',
  className = '',
}) {
  const scope = useGsapScope((_, el) => {
    const head = el.querySelector('.hero__title');
    const frame = el.querySelector('.hero__frame');
    const image = el.querySelector('.hero__frame img');
    const insetEl = el.querySelector('.hero__inset');

    if (reduced()) {
      // Nothing is hidden in CSS, so there is genuinely nothing to do here.
      return;
    }

    const tl = gsap.timeline({ paused: !stageOpen(), defaults: { ease: 'power4.out' } });

    tl.from('.hero__tag', { y: 16, autoAlpha: 0, duration: 0.7 }, 0);

    if (head) {
      // The hero is the one place `lines()` is not driven by a ScrollTrigger:
      // it is already in view, so waiting for a scroll position means waiting
      // forever.
      const split = el.querySelectorAll('.hero__line > span');
      tl.from(split, { yPercent: 118, duration: 1.25, stagger: 0.085 }, 0.15);
    }

    if (frame) {
      tl.from(
        frame,
        { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' },
        0.35,
      );
      if (image) tl.from(image, { scale: 1.07, duration: 1.9 }, 0.35);
    }

    if (insetEl) tl.from(insetEl, { scale: 0.7, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.5)' }, 0.95);

    tl.from('.hero__fig', { y: 22, autoAlpha: 0, duration: 0.8, stagger: 0.09 }, 0.85)
      .from('.hero__tail > *', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.85)
      .from('.hero__cue', { y: 14, autoAlpha: 0, duration: 0.8 }, 1.1);

    draw(el, { trigger: el, delay: 0.9, start: 'top bottom' });
    count(el.querySelectorAll('.hero__fig-value'), {
      trigger: el,
      start: 'top bottom',
      delay: 1,
    });

    if (image) drift(image, 80, { trigger: el });
    if (insetEl) drift(insetEl, -46, { trigger: el });

    const teardowns = Array.from(el.querySelectorAll('.btn')).map((b) => settle(b));
    const release = onStage(() => tl.play());

    return () => {
      // Unsubscribing first: a queued callback holding a killed timeline is a
      // leak with the stage watchdog's fuse on it.
      release();
      tl.kill();
      teardowns.forEach((fn) => fn?.());
    };
  }, []);

  return (
    <section ref={scope} className={`hero ${className}`.trim()}>
      <div className="hero__inner wrap">
        <div className="hero__type">
          {sticker ? (
            <div className="hero__tag">
              <Sticker tone="sun" tilt={-2.4}>
                {sticker}
              </Sticker>
            </div>
          ) : null}

          <h1 className="hero__title ed-hero">
            {title.map((line, i) => (
              // Each line is its own mask. Done in markup rather than with
              // SplitText because the breaks are authored, and a re-split on
              // resize would fight them.
              <span className="hero__line" key={i}>
                <span>{line}</span>
              </span>
            ))}
          </h1>

          <div className="hero__tail">
            {question ? <p className="hero__question meta">{question}</p> : null}
            {lead ? <p className="lead hero__lead">{lead}</p> : null}

            {actions.length ? (
              <div className="hero__actions">
                {actions.map((action) => {
                  const cls = `btn btn-${action.variant ?? 'primary'}`;
                  const inner = (
                    <span className="btn__label">
                      {action.label}
                      <Icon name="arrowRight" size={17} />
                    </span>
                  );
                  return action.to ? (
                    <Link className={cls} to={action.to} key={action.label}>
                      {inner}
                    </Link>
                  ) : (
                    <a className={cls} href={action.href} key={action.label}>
                      {inner}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="hero__media">
          <div className="hero__frame">
            <Figure
              photo={photo}
              width={1100}
              widths={[640, 1100, 1600]}
              sizes="(max-width: 900px) 92vw, 46vw"
              shape="frame"
              ratio="free"
              eager
              className="hero__fig-main"
            />
          </div>

          {inset ? (
            <div className="hero__inset">
              <Figure
                photo={inset}
                width={340}
                widths={[340, 620]}
                sizes="(max-width: 900px) 34vw, 15vw"
                shape="round"
                ratio="square-ar"
                decorative
              />
            </div>
          ) : null}

          {figures.length ? (
            <ul className="hero__figs">
              {figures.map((figure) => (
                <li className="hero__fig" key={figure.label}>
                  <span className="stat-num hero__fig-value">{figure.value}</span>
                  <span className="hero__fig-label">{figure.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <p className="hero__cue meta" aria-hidden="true">
        <span>{cue}</span>
        <i />
      </p>
    </section>
  );
}
