import { Icon } from '@/components/common/Icon';
import { cx } from '@/utils';
import { MODES } from './modes';

export function ChatHeader({ mode, titleId, onClose }) {
  const config = MODES[mode];

  return (
    <header className="fa-head">
      <span className={cx('fa-head__badge', `fa-head__badge--${mode}`)} aria-hidden="true">
        <Icon name="message" size={18} />
      </span>

      <div className="fa-head__text">
        <h2 id={titleId} className="fa-head__title">
          {config.title}
          {config.tag ? <span className="fa-head__tag">{config.tag}</span> : null}
        </h2>
        <p className="fa-head__sub">{config.subtitle}</p>
      </div>

      <button type="button" className="fa-head__close" onClick={onClose} aria-label={config.closeLabel}>
        <Icon name="close" size={18} />
      </button>
    </header>
  );
}
