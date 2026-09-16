import { useMemo, useState } from 'react';
import { useGsapScope } from '@/hooks/useGsapScope';
import { gsap } from '@/lib/gsap';
import { reduced, rise } from '@/lib/motion';
import { Figure } from './Figure';

export function AchievementArchive({
  entries,
  categories,
  allLabel = 'All',
  children,
  className = '',
  id,
}) {
  const [filter, setFilter] = useState(allLabel);

  const shown = useMemo(
    () => (filter === allLabel ? entries : entries.filter((e) => e.category === filter)),
    [entries, filter, allLabel],
  );

  /* Grouped by year at render, so a year is printed once however many entries
     sit under it. */
  const years = useMemo(() => {
    const map = new Map();
    shown.forEach((entry) => {
      const list = map.get(entry.year) ?? [];
      list.push(entry);
      map.set(entry.year, list);
    });
    return [...map.entries()];
  }, [shown]);

  const counts = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + 1));
    map.set(allLabel, entries.length);
    return map;
  }, [entries, allLabel]);

  const scope = useGsapScope((_, el) => {
    rise(el.querySelectorAll('.arch__year'), { trigger: el, y: 22, stagger: 0.07 });
  }, []);

  const change = (next) => {
    if (next === filter) return;
    setFilter(next);
    if (reduced()) return;
    // One gesture for the whole list rather than a stagger per row: the list
    // is being replaced, not rearranged.
    gsap.fromTo(
      '.arch__body',
      { y: 18, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power3.out', overwrite: 'auto' },
    );
  };

  return (
    <section ref={scope} id={id} className={`arch ${className}`.trim()}>
      <div className="wrap">
        {children ? <div className="arch__head">{children}</div> : null}

        <div className="arch__filters" role="group" aria-label="Filter the record by category">
          {[allLabel, ...categories.filter((c) => c !== allLabel)].map((category) => (
            <button
              key={category}
              type="button"
              className={`arch__filter${filter === category ? ' is-on' : ''}`}
              aria-pressed={filter === category}
              onClick={() => change(category)}
            >
              {category}
              <span className="arch__count">{counts.get(category) ?? 0}</span>
            </button>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          Showing {shown.length} {shown.length === 1 ? 'entry' : 'entries'}
          {filter === allLabel ? '' : ` in ${filter}`}.
        </p>

        <div className="arch__body">
          {years.length === 0 ? (
            <p className="arch__empty">Nothing recorded under this heading yet.</p>
          ) : (
            years.map(([year, group]) => (
              <section className="arch__year" key={year} aria-label={year}>
                <h3 className="arch__year-num" aria-hidden="true">
                  {year}
                </h3>

                <ol className="arch__rows">
                  {group.map((entry) => (
                    <li className="arch__row" key={entry.id}>
                      <Figure
                        photo={entry.photo}
                        width={340}
                        widths={[340, 620]}
                        sizes="(max-width: 800px) 30vw, 14vw"
                        shape="square"
                        ratio="landscape"
                        hover
                        className="arch__fig"
                        decorative
                      />
                      <div className="arch__text">
                        <p className="meta arch__cat">{entry.category}</p>
                        <h4 className="fn-h4 arch__title">{entry.title}</h4>
                        <p className="arch__detail">{entry.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
