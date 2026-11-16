import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ArrowLeft } from 'lucide-react';
import type { GalleryItem } from '../types/clinic.ts';

interface GallerySectionProps {
  items: GalleryItem[];
  standalonePage?: boolean;
  onNavigate?: (path: string) => void;
}

const CATEGORIES = [
  'All',
  'Clinic Reception',
  'Treatment Rooms',
  'Dental Equipment',
  'Dentist & Team',
  'Clinic Interior',
] as const;

export function GallerySection({ items, standalonePage = false, onNavigate }: GallerySectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const filtered =
    selectedCategory === 'All' ? items : items.filter((item) => item.category === selectedCategory);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? null : (i + 1) % filtered.length));
      if (e.key === 'ArrowLeft')
        setLightboxIdx((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIdx, filtered.length]);

  const activeItem = lightboxIdx !== null ? filtered[lightboxIdx] : null;
  const hasAnyOfficial = items.some((i) => i.isOfficialPhoto);

  return (
    <section id="gallery" className={standalonePage ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14' : 'py-20 bg-[#F1F7F7]'}>
      <div className={standalonePage ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
        {standalonePage && onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#71808D] hover:text-[#12304A] mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#19A7A1]">Clinic Environment</p>
            <h2 className="font-display text-3xl sm:text-4xl text-[#12304A] mt-1">
              {standalonePage ? 'Clinic Gallery & Spaces' : 'Inside Our Practice'}
            </h2>
            <p className="text-sm sm:text-base text-[#71808D] mt-2">
              {hasAnyOfficial
                ? 'Explore our reception lounge, treatment suites, and clinical environment in Subramanyanagar.'
                : 'Illustrative interior and clinical previews are displayed below until official clinic photographs are uploaded through the Admin Dashboard.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 bg-white rounded-lg border border-[#12304A]/10 self-start">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setLightboxIdx(null);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#12304A] text-white'
                    : 'text-[#71808D] hover:text-[#12304A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-[#12304A]/12 rounded-2xl p-10 text-center text-sm text-[#71808D]">
            No photographs added under &ldquo;{selectedCategory}&rdquo; yet. Clinic staff can upload official photos in the Admin Dashboard.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item, idx) => (
              <figure
                key={item.id}
                className="group bg-white border border-[#12304A]/12 rounded-2xl overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIdx(idx)}
                  aria-label={`View ${item.title} in lightbox`}
                  className="relative aspect-[4/3] bg-[#E8F0F0] overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-[#19A7A1]"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-[#12304A]/0 group-hover:bg-[#12304A]/20 transition-colors flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-white/95 text-[#12304A] flex items-center justify-center shadow-sm">
                      <ZoomIn className="w-4 h-4" />
                    </span>
                  </div>
                </button>
                <figcaption className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#71808D]">
                    <span className="font-medium text-[#19A7A1]">{item.category}</span>
                    <span>{item.isOfficialPhoto ? 'Clinic Photo' : 'Illustrative Preview'}</span>
                  </div>
                  <h3 className="font-display text-lg text-[#12304A]">{item.title}</h3>
                  {item.caption && <p className="text-xs text-[#71808D] leading-relaxed">{item.caption}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {activeItem && lightboxIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activeItem.title}
          className="fixed inset-0 z-50 bg-[#12304A]/92 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxIdx(null)}
              aria-label="Close lightbox"
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#12304A] flex items-center justify-center shadow cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="aspect-[4/3] max-h-[75vh] bg-[#12304A] flex items-center justify-center relative">
              <img
                src={activeItem.imageUrl}
                alt={activeItem.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              {filtered.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => setLightboxIdx((lightboxIdx - 1 + filtered.length) % filtered.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#12304A] flex items-center justify-center shadow cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % filtered.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#12304A] flex items-center justify-center shadow cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
              <div>
                <p className="text-xs font-semibold text-[#19A7A1]">
                  {activeItem.category} · {activeItem.isOfficialPhoto ? 'Official Clinic Photo' : 'Illustrative Preview'}
                </p>
                <h3 className="font-display text-xl text-[#12304A]">{activeItem.title}</h3>
                {activeItem.caption && <p className="text-xs text-[#71808D] mt-0.5">{activeItem.caption}</p>}
              </div>
              <span className="text-xs font-mono text-[#71808D] tabular-nums">
                {lightboxIdx + 1} / {filtered.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
