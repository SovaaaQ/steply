import type { CSSProperties } from "react";

export const MOBILE_LOGO_PRELOADER_DURATION_MS = 1200;
export const MOBILE_LOGO_PRELOADER_QUERY = "(max-width: 767px)";

export function isMobileAuthViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_LOGO_PRELOADER_QUERY).matches
  );
}

export function MobileLogoPreloader({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }

  const preloaderStyle = {
    "--mobile-logo-preloader-duration": `${MOBILE_LOGO_PRELOADER_DURATION_MS}ms`
  } as CSSProperties;

  return (
    <div
      className="mobile-logo-preloader"
      role="status"
      aria-live="polite"
      style={preloaderStyle}
    >
      <div className="mobile-logo-preloader-mark">S</div>
      <span className="visually-hidden">Загружаем Steply</span>
    </div>
  );
}
