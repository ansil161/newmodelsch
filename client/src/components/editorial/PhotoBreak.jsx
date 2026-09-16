import { useGsapScope } from '@/hooks/useGsapScope';
import { drift, unmask } from '@/lib/motion';
import { Figure } from './Figure';

export function PhotoBreak({ photos, caption, flip = false, className = '' }) {
  const scope = useGsapScope((_, el) => {
    const frames = el.querySelectorAll('.pbreak__frame');
    unmask(frames, { trigger: el, from: 'bottom', stagger: 0.14 });

    // Three speeds. The largest frame moves least, which is what makes the
    // small ones read as being nearer to the reader.
    const [a, b, c] = Array.from(frames);
    if (a) drift(a.querySelector('img'), 42, { trigger: el });
    if (b) drift(b.querySelector('img'), 96, { trigger: el });
    if (c) drift(c.querySelector('img'), 66, { trigger: el });
  }, []);

  return (
    <section
      ref={scope}
      className={`pbreak${flip ? ' pbreak--flip' : ''} ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="pbreak__inner wrap">
        <div className="pbreak__frame pbreak__frame--a">
          <Figure photo={photos[0]} width={420} sizes="(max-width: 900px) 40vw, 20vw" shape="blob" ratio="portrait" decorative />
        </div>
        <div className="pbreak__frame pbreak__frame--b">
          <Figure photo={photos[1]} width={860} sizes="(max-width: 900px) 78vw, 42vw" shape="frame" ratio="landscape" decorative />
        </div>
        <div className="pbreak__frame pbreak__frame--c">
          <Figure photo={photos[2]} width={360} sizes="(max-width: 900px) 34vw, 17vw" shape="round" ratio="square-ar" decorative />
        </div>

        {caption ? <p className="pbreak__caption meta">{caption}</p> : null}
      </div>
    </section>
  );
}
