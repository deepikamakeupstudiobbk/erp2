import React, { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { card, PageHeader } from './ui';
import { money, prettyDate, rowPending, today, whatsappLink } from './util';
import type { Row } from './util';

const addDays = (iso: string, d: number) => {
  const x = new Date(iso + 'T00:00:00');
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

export const NotificationsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { bookingEntries, dailyEntries } = useStudio();
  const all: Row[] = useMemo(
    () => [...bookingEntries.map(e => ({ ...e, kind: 'booking' as const })), ...dailyEntries.map(e => ({ ...e, kind: 'daily' as const }))],
    [bookingEntries, dailyEntries]
  );

  const t = today();
  const upcoming = all.filter(e => e.kind === 'booking' && e.eventDate >= t && e.eventDate <= addDays(t, 7)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const dues = all.filter(e => rowPending(e) > 0).sort((a, b) => rowPending(b) - rowPending(a));

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Aane wale events aur baaki payment ke reminder – WhatsApp se ek click mein bhejo" onBack={onBack} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${card} p-4`}>
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#ffd700]">Agle 7 din ke Events ({upcoming.length})</h3>
          {upcoming.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Agle 7 din mein koi booking nahi.</p>}
          {upcoming.map(e => (
            <div key={e.id} className="flex items-center gap-3 border-b border-slate-800 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{e.clientName}</div>
                <div className="text-[11px] text-slate-400">
                  {prettyDate(e.eventDate)} · {e.packageName}
                </div>
              </div>
              <a
                href={whatsappLink(e.mobile, `Namaste ${e.clientName}, Deepika Makeup Studio se yaad dilana tha: aapki ${e.packageName} booking ${prettyDate(e.eventDate)} ko hai. Koi sawal ho to bataiye.`)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Remind
              </a>
            </div>
          ))}
        </div>

        <div className={`${card} p-4`}>
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#ffd700]">Baaki Payment ({dues.length})</h3>
          <div className="max-h-[520px] overflow-y-auto">
            {dues.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Koi payment baaki nahi. 🎉</p>}
            {dues.map(e => (
              <div key={e.kind + e.id} className="flex items-center gap-3 border-b border-slate-800 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{e.clientName}</div>
                  <div className="text-[11px] text-slate-400">
                    {e.packageName} · {e.mobile}
                  </div>
                </div>
                <div className="text-sm font-bold text-rose-400">{money(rowPending(e))}</div>
                <a
                  href={whatsappLink(e.mobile, `Namaste ${e.clientName}, Deepika Makeup Studio ki taraf se: aapka ${money(rowPending(e))} baaki hai (${e.packageName}). Kripya suvidha anusaar bhej dein. Dhanyavaad!`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Remind
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
