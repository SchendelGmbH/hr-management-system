'use client';

import { useRouter } from 'next/navigation';

export default function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer ${className ?? ''}`}
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
