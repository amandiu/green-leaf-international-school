/**
 * LEADERSHIP MESSAGES — Homepage section data
 * ────────────────────────────────────────────
 * Single source of truth for the Leadership Message 2×2 grid section.
 * Structured for future Admin/API integration (docs/DATABASE.md plans an
 * `About.principalMessage` field): swap these local values for API data
 * without touching the component.
 *
 * DATA SAFETY (per project rules): names, messages, and portrait images are
 * NOT invented. Verified values are `null` until provided by the school.
 * The component renders a dignified placeholder only when a field is null.
 */

import { siteConfig } from '../../../shared/config/siteConfig';

export const leadershipMessages = [
  {
    id: "principal",
    role: "Principal",
    roleBadge: "Principal",
    heading: "Message from the Principal",
    /** Official message text — NOT verified, do not fabricate. */
    message: null,
    /** Full name — NOT verified, do not fabricate. */
    name: null,
    /** Official designation line under the name. */
    designation: `Principal, ${siteConfig.identity.name}`,
    /** Portrait — no verified Principal image exists in client/public. */
    image: null,
    /**
     * Alt text used ONLY when `image` is set AND identity is verified.
     * Kept null while image is null so no false claims are made to AT.
     */
    imageAlt: null,
    /** Fallback shown when message is null (explicitly marked as pending). */
    placeholderMessage:
      "The official Principal's message will be published here once verified content is provided by the school.",
  },
  {
    id: "chairman",
    role: "Chairman",
    roleBadge: "Chairman",
    heading: "Message from the Chairman",
    /** Official message text — NOT verified, do not fabricate. */
    message: null,
    /** Full name — NOT verified, do not fabricate. */
    name: null,
    /** Official designation line under the name. */
    designation: `Chairman, ${siteConfig.identity.name}`,
    /** Portrait — no verified Chairman image exists in client/public. */
    image: null,
    /** Alt text used ONLY when image is set AND identity is verified. */
    imageAlt: null,
    /** Fallback shown when message is null (explicitly marked as pending). */
    placeholderMessage:
      "The official Chairman's message will be published here once verified content is provided by the school.",
  },
];

export default leadershipMessages;
