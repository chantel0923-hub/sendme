// Shared constants and link helpers for the share features (share cards, flyers, invite links).
export const SITE_ORIGIN = "https://sendmeglobalmission.org";

// The registered non-profit company — printed on flyers so people can check who is behind SendMe.
// (Name and registration number as shown on the FNB account confirmation letter, 2026-08-26.)
export const NPC_NAME   = "SendMe Global Mission Fund NPC";
export const NPC_REG_NO = "2026/630532/08";

// Optional contact line printed at the bottom of church flyers, e.g. "Questions? WhatsApp Br Donald on +27 …".
// Leave empty to print nothing.
export const FLYER_CONTACT = "";

// Every link that is shared carries ?from=friend, so the sign-up form can pre-select "A friend or family
// member" for people who arrive through it.
export const siteLink    = () => `${SITE_ORIGIN}/?from=friend`;
export const missionLink = (id) => `${SITE_ORIGIN}/mission/${id}?from=friend`;

// A church's own invite link. The code is the first 8 characters of the church's id — short enough for a
// QR code, and enough to tell churches apart. People who sign up through it are counted per church.
export const churchRefCode = (churchId) => String(churchId || "").slice(0, 8).toLowerCase();
export const isChurchRefCode = (c) => /^[a-f0-9]{8}$/.test(String(c || ""));
export const churchLink = (churchId) => `${SITE_ORIGIN}/?from=church&c=${churchRefCode(churchId)}`;
