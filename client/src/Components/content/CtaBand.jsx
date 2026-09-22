// ------------------------------------------------------------
// CtaBand — shared renderer for reusable CTA blocks (Phase D)
//
// Renders a RESOLVED CTA block's eyebrow/title/description and a
// selected pair of actions. The consumer passes which action ids
// to show and per-page button presentation, so each page keeps
// its own visual design while sharing ONE block of content.
//
// The block must come from useReusableContent().getBlock(key),
// which resolves {{settings}} tokens — CtaBand renders plain
// strings and knows nothing about settings or APIs.
//
// Fallback behavior: null/undefined block or missing actions are
// handled with safe fallbacks (renders nothing) — never a
// runtime crash.
// ------------------------------------------------------------

import { Link } from 'react-router-dom';
import Button from '../ui/Button';

/**
 * Render one action:
 *   internal path  → React Router <Link>
 *   mailto:/tel:   → <a href>
 *   http(s)        → <a target=_blank rel=noopener>
 * Missing/unresolvable actions render nothing.
 */
function CtaAction({ action, buttonProps }) {
  if (!action || !action.label || !action.href) return null;

  const isInternal = action.href.startsWith('/');
  const isExternalHttp = /^https?:\/\//.test(action.href);

  if (isInternal) {
    return (
      <Link to={action.href} className="group">
        <Button {...buttonProps}>{action.label}</Button>
      </Link>
    );
  }
  return (
    <a
      href={action.href}
      {...(isExternalHttp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="group"
    >
      <Button {...buttonProps}>{action.label}</Button>
    </a>
  );
}

/**
 * CtaBand content renderer. Presentation (section background,
 * layout classes) stays in the consumer page; this renders the
 * shared content + actions.
 *
 * @param {object}   block                resolved reusable block (or null)
 * @param {string[]} actionIds            action ids this page shows, in order
 * @param {object[]} actionButtonProps    Button props per action slot
 *                                        (index-matched to actionIds)
 * @param {string}   descriptionClass     per-page description styling
 */
export default function CtaBand({ block, actionIds, actionButtonProps = [], descriptionClass = 'text-white/60' }) {
  if (!block || block.isActive === false) return null;

  const { eyebrow = '', title = '', description = '' } = block;
  const actionsById = new Map((block.actions || []).map((a) => [a.id, a]));
  const selected = (actionIds || [])
    .map((id) => actionsById.get(id))
    .filter(Boolean);

  return (
    <>
      {eyebrow && (
        <span className="eyebrow mb-4 inline-block !text-leaf-300">{eyebrow}</span>
      )}
      {title && <h2 className="font-heading text-h2 text-white mb-4">{title}</h2>}
      {description && (
        <p className={`text-body-lg mb-8 max-w-xl mx-auto ${descriptionClass}`}>{description}</p>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {selected.map((action, index) => (
            <CtaAction
              key={action.id}
              action={action}
              buttonProps={actionButtonProps[index] || {}}
            />
          ))}
        </div>
      )}
    </>
  );
}
