// WhatsAppSupportButton.js — A small floating WhatsApp button, visible on
// every screen (mounted globally in index.js, not inside App.js's own
// screen-switching), so someone stuck on any form or flow always has a
// one-tap way to reach real support.
const SUPPORT_NUMBER = "27726240395"; // international format, no +, no spaces
const DEFAULT_MESSAGE = "Hi! I need help with the SendMe app 🙏";

export default function WhatsAppSupportButton() {
  const href = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get help on WhatsApp"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 9999,
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: "#25d366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
        textDecoration: "none",
      }}
    >
      <svg viewBox="0 0 32 32" width="30" height="30" fill="#fff">
        <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.31.66 4.463 1.803 6.29L4 29l7.94-1.76A11.93 11.93 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm6.98 17.02c-.297.836-1.47 1.53-2.406 1.73-.64.135-1.475.244-4.29-.92-3.6-1.49-5.914-5.14-6.095-5.38-.176-.24-1.457-1.94-1.457-3.7 0-1.76.914-2.62 1.24-2.98.297-.325.65-.406.867-.406.216 0 .434.002.624.012.2.01.47-.076.735.56.297.71.98 2.47 1.065 2.65.086.18.144.39.028.63-.115.24-.173.39-.343.6-.172.21-.36.47-.516.63-.172.18-.353.375-.152.735.2.36.89 1.47 1.912 2.38 1.313 1.17 2.42 1.53 2.78 1.7.36.18.573.15.786-.09.216-.24.917-1.07 1.163-1.44.245-.36.49-.3.82-.18.335.12 2.12 1 2.484 1.18.36.18.6.27.688.42.086.15.086.87-.212 1.71z"/>
      </svg>
    </a>
  );
}
