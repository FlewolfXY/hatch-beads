import { CSSProperties } from 'react';

type P = { size?: number; style?: CSSProperties };
const S = ({ size = 20, style, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {children}
  </svg>
);

export const Back = (p: P) => (
  <S {...p}>
    <path d="M15 5l-7 7 7 7" />
  </S>
);
export const SoundOn = (p: P) => (
  <S {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
  </S>
);
export const SoundOff = (p: P) => (
  <S {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </S>
);
export const Box = (p: P) => (
  <S {...p}>
    <rect x="3" y="6" width="18" height="14" rx="3" />
    <circle cx="8" cy="11" r="1.4" />
    <circle cx="12" cy="11" r="1.4" />
    <circle cx="16" cy="11" r="1.4" />
    <circle cx="8" cy="15" r="1.4" />
    <circle cx="12" cy="15" r="1.4" />
    <path d="M7 6V4h10v2" />
  </S>
);
export const Pin = (p: P) => (
  <S {...p}>
    <path d="M9 3h6l-1 6 3 3H7l3-3-1-6z" />
    <path d="M12 12v9" />
  </S>
);
export const Copy = (p: P) => (
  <S {...p}>
    <rect x="8" y="8" width="12" height="12" rx="3" />
    <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
  </S>
);
export const Download = (p: P) => (
  <S {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </S>
);
export const Camera = (p: P) => (
  <S {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </S>
);
export const Heart = (p: P & { filled?: boolean }) => (
  <S {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill={p.filled ? 'currentColor' : 'none'} />
  </S>
);
export const Shuffle = (p: P) => (
  <S {...p}>
    <path d="M4 7h3c4 0 6 10 10 10h3M17 14l3 3-3 3M4 17h3c1.6 0 2.8-1.6 3.8-3.6M14 8.5C15 7.5 16 7 17 7h3M17 4l3 3-3 3" />
  </S>
);
export const Grid = (p: P) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" />
  </S>
);
export const Card = (p: P) => (
  <S {...p}>
    <rect x="5" y="3" width="14" height="18" rx="2.5" />
    <circle cx="12" cy="10" r="3" />
    <path d="M9 16h6" />
  </S>
);
export const Link = (p: P) => (
  <S {...p}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </S>
);
export const Check = (p: P) => (
  <S {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </S>
);
export const Edit = (p: P) => (
  <S {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
  </S>
);
export const Sparkle = (p: P) => (
  <S {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </S>
);
export const Close = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
);
export const Image = (p: P) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M21 16l-5-5-8 8" />
  </S>
);
