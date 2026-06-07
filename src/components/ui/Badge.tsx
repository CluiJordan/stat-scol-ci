import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  color?: 'orange' | 'navy' | 'gray';
}

export default function Badge({ children, color = 'gray' }: Props) {
  const colors = {
    orange: 'bg-orange-50 text-[#D95F18] border border-orange-200',
    navy: 'bg-[#1C2B3A]/10 text-[#1C2B3A] border border-[#1C2B3A]/20',
    gray: 'bg-black/5 text-gray-500 border border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide ${colors[color]}`}
    >
      {children}
    </span>
  );
}
