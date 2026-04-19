import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Rewind, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGraphStore } from './useGraphStore';
import type { WorkGraphData } from './types';

interface Props {
  data: WorkGraphData;
}

// Historical playback of the graph using `createdAt` timestamps. The slider
// spans from the earliest node to now, and the currently-rendered graph is
// re-derived via `asOf` in the store (see useWorkGraph).
export function TimelineSlider({ data }: Props) {
  const timelineActive = useGraphStore((s) => s.timelineActive);
  const setTimelineActive = useGraphStore((s) => s.setTimelineActive);
  const asOf = useGraphStore((s) => s.asOf);
  const setAsOf = useGraphStore((s) => s.setAsOf);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  const bounds = useMemo(() => {
    let min = Infinity;
    for (const n of data.nodes) {
      if (!n.createdAt) continue;
      const t = new Date(n.createdAt).getTime();
      if (Number.isFinite(t) && t < min) min = t;
    }
    const max = Date.now();
    if (!Number.isFinite(min) || min >= max) min = max - 1000 * 60 * 60 * 24 * 30; // 30d fallback
    return { min, max };
  }, [data.nodes]);

  const current = asOf ? new Date(asOf).getTime() : bounds.max;

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const startReal = performance.now();
    const startGraph = current;
    const range = bounds.max - bounds.min;
    // Play the full history in ~20 seconds; feel fast enough to be engaging,
    // slow enough to see clusters form.
    const speed = range / 20000;
    const step = (tsNow: number) => {
      const advanced = (tsNow - startReal) * speed;
      const next = Math.min(bounds.max, startGraph + advanced);
      setAsOf(new Date(next).toISOString());
      if (next >= bounds.max) { setPlaying(false); return; }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, bounds.min, bounds.max]);

  if (!timelineActive) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-6 z-20 w-[min(720px,calc(100%-3rem))] rounded-2xl border bg-card/95 backdrop-blur shadow-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setPlaying(false); setAsOf(new Date(bounds.min).toISOString()); }} title="Ir al inicio">
            <Rewind className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="default" className="h-8 w-8" onClick={() => setPlaying((p) => !p)} title={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex-1">
          <Slider
            min={bounds.min}
            max={bounds.max}
            step={Math.max(1, Math.round((bounds.max - bounds.min) / 400))}
            value={[current]}
            onValueChange={([v]) => setAsOf(new Date(v).toISOString())}
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 tabular-nums">
            <span>{format(new Date(bounds.min), 'dd MMM yyyy', { locale: es })}</span>
            <span className="font-semibold text-foreground">{format(new Date(current), 'dd MMM yyyy HH:mm', { locale: es })}</span>
            <span>Hoy</span>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setPlaying(false); setTimelineActive(false); }} title="Cerrar timeline">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
