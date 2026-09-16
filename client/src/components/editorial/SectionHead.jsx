import { useGsapScope } from '@/hooks/useGsapScope';
import { draw, lines, rise } from '@/lib/motion';
import { Sticker } from './primitives';

export function SectionHead({
  sticker,
  stickerTone = 'sun',
  stickerTilt = -2.2,
  title,
  as: Tag = 'h2',
  size = 'h1',
  lead,
  children,
  align = 'left',
  className = '',
  id,
}) {
  const scope = useGsapScope((_, el) => {
    const head = el.querySelector('[data-sh-title]');
    const tag = el.querySelector('[data-sh-sticker]');
    const tail = el.querySelectorAll('[data-sh-tail] > *');

    if (tag) rise(tag, { trigger: el, y: 14, delay: 0 });
    if (head) lines(head, { trigger: el, delay: 0.1 });
    draw(el, { trigger: el, delay: 0.55 });
    if (tail.length) rise(tail, { trigger: el, delay: 0.6, y: 20 });
  }, []);

  return (
    <div
      ref={scope}
      id={id}
      className={`sec-head${align === 'centre' ? ' sec-head--centre' : ''} ${className}`.trim()}
    >
      {sticker ? (
        <div data-sh-sticker className="sec-head__tag">
          <Sticker tone={stickerTone} tilt={stickerTilt}>
            {sticker}
          </Sticker>
        </div>
      ) : null}

      <Tag data-sh-title className={`ed-${size} sec-head__title`}>
        {title}
      </Tag>

      {lead || children ? (
        <div data-sh-tail className="sec-head__tail">
          {lead ? <p className="lead sec-head__lead">{lead}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
