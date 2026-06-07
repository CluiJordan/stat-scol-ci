import React from 'react';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-[#1C2B3A] hover:bg-[#0F1E2C] text-white',
  secondary: 'bg-white hover:bg-[#F5F0EB] text-[#1C2B3A] border border-[#E5DDD5]',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'hover:bg-[#F5F0EB] text-[#1C2B3A]',
  accent: 'bg-[#F4732A] hover:bg-[#D95F18] text-white',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
