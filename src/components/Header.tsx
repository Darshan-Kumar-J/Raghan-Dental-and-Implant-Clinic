import { useState } from 'react';
import { Menu, X, Phone, Calendar, MessageCircle } from 'lucide-react';
import { ClinicLogo } from './ClinicLogo.tsx';
import { buildWhatsAppUrl } from '../lib/clinicUtils.ts';
import type { ClinicSettings } from '../types/clinic.ts';

interface HeaderProps {
  settings: ClinicSettings;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Header({ settings, currentPath, onNavigate }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/#about' },
    { label: 'Treatments', path: '/treatments' },
    { label: 'Our Dentist', path: '/#doctor' },
    { label: 'Gallery', path: '/gallery' },
    { label: 'Contact', path: '/contact' },
  ];

  const handleLinkClick = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  const waUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    'Hello Raghan Dental and Implant Care, I would like to enquire about booking a dental appointment.',
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#FAFCFC]/95 backdrop-blur-md border-b border-[#12304A]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick('/');
            }}
            className="flex items-center gap-3 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#19A7A1] rounded-lg"
          >
            <ClinicLogo logoUrl={settings.logoUrl} clinicName={settings.clinicName} size="sm" />
            <span className="font-display text-lg sm:text-xl text-[#12304A] tracking-tight whitespace-nowrap shrink-0">
              Raghan Dental &amp; Implant Care
            </span>
          </a>

          {/* Zone 2: Clean Text Navigation Links */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#263746]">
            {navItems.map((item) => {
              const isActive =
                item.path === '/'
                  ? currentPath === '/'
                  : !item.path.includes('#') && currentPath.startsWith(item.path);
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(item.path);
                  }}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    isActive
                      ? 'border-[#19A7A1] text-[#12304A] font-semibold'
                      : 'border-transparent hover:border-[#19A7A1]/60 hover:text-[#12304A]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Right Phone + Book Appointment CTA */}
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <a
              href={`tel:${settings.phone.replace(/\s+/g, '')}`}
              className="hidden xl:inline-flex items-center gap-2 text-sm font-medium text-[#12304A] hover:text-[#19A7A1] transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <Phone className="w-4 h-4 text-[#19A7A1]" />
              <span>{settings.phone}</span>
            </a>
            <button
              type="button"
              onClick={() => handleLinkClick('/book')}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#12304A] hover:bg-[#19A7A1] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#19A7A1]"
            >
              Book Appointment
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#12304A] hover:bg-[#F1F7F7] cursor-pointer"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-[#12304A]/10 bg-[#FAFCFC] px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.path);
                }}
                className="block px-3 py-2.5 rounded-lg text-base font-medium text-[#263746] hover:bg-[#F1F7F7] hover:text-[#12304A]"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-3 border-t border-[#12304A]/10 flex flex-col gap-2">
              <a
                href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-[#12304A]/20 text-sm font-semibold text-[#12304A]"
              >
                <Phone className="w-4 h-4 text-[#19A7A1]" />
                <span>Call {settings.phone}</span>
              </a>
              <button
                type="button"
                onClick={() => handleLinkClick('/book')}
                className="w-full py-2.5 px-4 rounded-lg bg-[#12304A] text-white text-sm font-semibold cursor-pointer"
              >
                Book Appointment
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Sticky Bottom Action Bar (compact height <= 52px to stay well under 15% mobile viewport cap) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FAFCFC]/95 backdrop-blur-md border-t border-[#12304A]/15 grid grid-cols-3 h-13">
        <a
          href={`tel:${settings.phone.replace(/\s+/g, '')}`}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#12304A] border-r border-[#12304A]/10"
        >
          <Phone className="w-4 h-4 text-[#19A7A1]" />
          <span>Call</span>
        </a>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#12304A] border-r border-[#12304A]/10"
        >
          <MessageCircle className="w-4 h-4 text-[#19A7A1]" />
          <span>WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={() => handleLinkClick('/book')}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#12304A] text-white cursor-pointer"
        >
          <Calendar className="w-4 h-4 text-[#C6A66B]" />
          <span>Book</span>
        </button>
      </div>
    </>
  );
}
