import { useId } from "react";

/** Marca Aurora: gradiente violeta para ciano com duas ondas. */
export default function Logo({ size = 34 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8E80FF" />
          <stop offset="1" stopColor="#4FD1E0" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="10" fill={`url(#${id})`} />
      <path d="M6 24c4-12 9-14 11-14s7 2 11 14" fill="none" stroke="#0D1017" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 24c2-6 4.5-8 6-8s4 2 6 8" fill="none" stroke="#0D1017" strokeWidth="2.6" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
