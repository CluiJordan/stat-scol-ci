import React from 'react';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', ...props }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-[#1C2B3A] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1C2B3A]/20 focus:border-[#1C2B3A] transition-all placeholder:text-gray-300 disabled:bg-[#F5F0EB] disabled:text-gray-400 ${
          error ? 'border-red-400' : 'border-[#E5DDD5]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
