import type { ButtonHTMLAttributes } from 'react';

/** Small stroke icons drawn for this app (24×24 grid, currentColor). */
const PATHS = {
  send: <path d="M12 19V5M6 11l6-6 6 6" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />,
  speaker: <path d="M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />,
  mute: <path d="M4 9v6h4l5 4V5L8 9H4zM17 9.5l5 5M22 9.5l-5 5" />,
  pause: <path d="M8 5v14M16 5v14" />,
  play: <path d="M8 5v14l11-7z" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  rewind: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  compare: <path d="M4 4h16v16H4zM12 4v16" />,
  spark: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  copy: <path d="M9 9h11v11H9zM15 9V4H4v11h5" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  back: <path d="M15 18l-6-6 6-6" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12l5 5 9-10" />,
  wave: <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="i"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** An icon-only button. `label` is both the accessible name and the hover tooltip. */
export function IconButton({
  icon,
  label,
  className = '',
  ...rest
}: { icon: IconName; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`icon ${className}`} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}
