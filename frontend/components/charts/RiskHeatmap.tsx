"use client";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`
);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function heatColor(value: number) {
  if (value === 0) return "var(--ds-base-border)";
  if (value < 0.25) return "color-mix(in oklch, var(--ds-emerald) 40%, transparent)";
  if (value < 0.5)  return "color-mix(in oklch, var(--ds-alert-1) 50%, transparent)";
  if (value < 0.75) return "color-mix(in oklch, var(--ds-coral) 60%, transparent)";
  return "color-mix(in oklch, var(--ds-alert-3) 70%, transparent)";
}

interface Props {
  data: number[][]; // [day][hour] avg score 0-1
}

export function RiskHeatmap({ data }: Props) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 600 }}>
        {/* Hour labels */}
        <div className="flex gap-px pl-10 mb-1">
          {HOURS.map((h, i) =>
            i % 3 === 0 ? (
              <div key={h} className="flex-1 text-center text-caption text-muted-foreground" style={{ fontSize: 9 }}>
                {h}
              </div>
            ) : (
              <div key={h} className="flex-1" />
            )
          )}
        </div>

        {/* Rows */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-px mb-px">
            <span className="text-caption text-muted-foreground w-8 text-right pr-2" style={{ fontSize: 9 }}>
              {day}
            </span>
            {HOURS.map((_, hi) => {
              const val = data[di]?.[hi] ?? 0;
              return (
                <div
                  key={hi}
                  className="flex-1 rounded-sm transition-colors cursor-default"
                  style={{ height: 16, background: heatColor(val) }}
                  title={`${day} ${HOURS[hi]}: ${(val * 100).toFixed(0)}% risk`}
                />
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 pl-10">
          <span className="text-caption text-muted-foreground" style={{ fontSize: 9 }}>Less</span>
          {[0, 0.2, 0.4, 0.65, 0.9].map((v) => (
            <div key={v} className="w-4 h-3 rounded-sm" style={{ background: heatColor(v) }} />
          ))}
          <span className="text-caption text-muted-foreground" style={{ fontSize: 9 }}>More risk</span>
        </div>
      </div>
    </div>
  );
}
