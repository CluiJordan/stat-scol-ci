interface Props {
  children: React.ReactNode;
  color?: 'green' | 'blue' | 'gray';
}

export default function Badge({ children, color = 'gray' }: Props) {
  const colors = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
