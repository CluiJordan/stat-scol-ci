export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1.5" y="1.5" width="37" height="37" rx="9" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.6"/>
      <rect x="8" y="8" width="24" height="24" rx="3.5" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="11" y="25" width="3.5" height="5" rx="0.5" fill="currentColor" fillOpacity="0.7"/>
      <rect x="15.5" y="21" width="3.5" height="9" rx="0.5" fill="currentColor" fillOpacity="0.7"/>
      <rect x="20" y="17.5" width="3.5" height="12.5" rx="0.5" fill="currentColor" fillOpacity="0.7"/>
      <rect x="24.5" y="13" width="3.5" height="17" rx="0.5" fill="#F4732A"/>
      <polyline
        points="12.75,24 17.25,20 21.75,16.5 26.25,12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12.75" cy="24" r="1.4" fill="currentColor"/>
      <circle cx="17.25" cy="20" r="1.4" fill="currentColor"/>
      <circle cx="21.75" cy="16.5" r="1.4" fill="currentColor"/>
      <circle cx="26.25" cy="12" r="1.4" fill="currentColor"/>
    </svg>
  );
}
