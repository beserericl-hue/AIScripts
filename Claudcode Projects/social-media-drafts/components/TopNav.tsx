'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, Calendar, Settings } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/drafts', label: 'Drafts', icon: FileText },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function TopNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#262626]">
      <div className="flex items-center justify-between h-20 px-8">
        {/* Logo and Title */}
        <Link href="/" className="flex items-center gap-4">
          <Image
            src="/logo.svg"
            alt="Social Media Editor Logo"
            width={44}
            height={44}
            className="rounded-lg"
          />
          <span className="text-2xl font-bold text-white">
            Social Media <span className="text-[#D4AF37]">Editor</span>
          </span>
        </Link>

        {/* Navigation Items - Square Buttons */}
        <nav className="flex items-center gap-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center gap-2 w-32 h-10 rounded-md text-sm font-semibold transition-all border ${
                  active
                    ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                    : 'bg-[#1a1a1a] text-[#A3A3A3] border-[#333333] hover:text-white hover:border-[#D4AF37] hover:bg-[#262626]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
