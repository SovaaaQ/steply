import type { AppSection } from "../../types/navigation";

export function NavIcon({ section }: { section: AppSection }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (section) {
    case "habits":
      return (
        <svg {...commonProps}>
          <path d="M8 7h12" />
          <path d="M8 12h12" />
          <path d="M8 17h12" />
          <path d="m3 7 1 1 2-2" />
          <path d="m3 12 1 1 2-2" />
          <path d="m3 17 1 1 2-2" />
        </svg>
      );
    case "pet":
      return (
        <svg {...commonProps}>
          <path d="M12 5c2.8 0 5 2.1 5 4.9 0 2.5-1.9 4.5-5 7.1-3.1-2.6-5-4.6-5-7.1C7 7.1 9.2 5 12 5Z" />
          <path d="M8.5 4.2 7 2.8" />
          <path d="M15.5 4.2 17 2.8" />
          <path d="M10 10h.01" />
          <path d="M14 10h.01" />
          <path d="M10.5 13c.8.6 2.2.6 3 0" />
        </svg>
      );
    case "recommendations":
      return (
        <svg {...commonProps}>
          <path d="M12 3v3" />
          <path d="M18.4 5.6 16.3 7.7" />
          <path d="M21 12h-3" />
          <path d="M5.6 5.6 7.7 7.7" />
          <path d="M3 12h3" />
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M8 13a4 4 0 1 1 8 0c0 1.3-.7 2.2-1.5 3h-5C8.7 15.2 8 14.3 8 13Z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...commonProps}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "dashboard":
    default:
      return (
        <svg {...commonProps}>
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6.5 10.5V20h11v-9.5" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
  }
}
