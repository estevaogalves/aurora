const PATHS = {
  painel: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  projecao: "M3 17l6-6 4 4 8-9M15 6h6v6",
  comparacao: "M5 20V10M12 20V4M19 20v-7",
  metas: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7a5 5 0 100 10 5 5 0 000-10zM12 11a1 1 0 100 2 1 1 0 000-2z",
  relatorios: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7",
  lanc: "M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  plus: "M12 5v14M5 12h14",
  sun: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  down: "M12 4v12M6 12l6 6 6-6M5 21h14",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  restore: "M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5",
  dots: "M12 5v.01M12 12v.01M12 19v.01",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  check: "M5 12l5 5L20 7",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  chevronL: "M15 18l-6-6 6-6",
  chevronR: "M9 6l6 6-6 6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  logout: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
  calendar: "M5 5h14v15H5zM5 9h14M9 3v4M15 3v4",
  upload: "M12 16V4M6 10l6-6 6 6M5 21h14",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} strokeWidth={name === "dots" ? 3 : undefined} />
    </svg>
  );
}
