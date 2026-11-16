import { useState, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import type { FaqItem } from '../types/clinic.ts';

interface FaqSectionProps {
  faqs: FaqItem[];
}

export function FaqSection({ faqs }: FaqSectionProps) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(faqs[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }, [faqs, query]);

  return (
    <section id="faqs" className="py-20 bg-[#FAFCFC]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-sm font-semibold text-[#19A7A1]">Patient Guide</p>
          <h2 className="font-display text-3xl sm:text-4xl text-[#12304A] mt-1">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-[#71808D] mt-2">
            Clear answers about booking, clinic location, and what to expect during your dental consultation.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <Search className="w-4 h-4 text-[#71808D] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions (e.g. booking, location, reschedule, consultation)..."
            aria-label="Search frequently asked questions"
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-[#12304A]/15 text-sm text-[#263746] focus:outline-none focus:border-[#19A7A1]"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white border border-[#12304A]/12 rounded-xl p-8 text-center text-sm text-[#71808D]">
            No questions match &ldquo;{query}&rdquo;. Try another keyword or call us at +91 70263 70619.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-white border border-[#12304A]/12 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#F1F7F7]/60 transition-colors cursor-pointer"
                  >
                    <span className="font-sans font-semibold text-sm sm:text-base text-[#12304A]">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#19A7A1] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-sm text-[#263746] leading-relaxed border-t border-[#12304A]/5">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
