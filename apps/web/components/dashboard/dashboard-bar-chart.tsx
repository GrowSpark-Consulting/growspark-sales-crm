"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ChartDatum {
  label: string;
  value: number;
  /** A fixed design-token colour (e.g. "var(--success)") for this one bar — falls back to the chart's default. */
  color?: string;
}

/**
 * A single-series bar chart card: title, the chart itself (decorative,
 * aria-hidden), and a visually-hidden table carrying the same values for
 * screen readers — the "accessible label and a table or text alternative"
 * every Day 4 dashboard chart needs. Colours are design tokens only
 * (--data-1..6, or a status tone passed in per datum); Recharts resolves
 * `var(--token)` fill/stroke values at render time, so light/dark both
 * repaint automatically with the rest of the app's theme.
 */
export function DashboardBarChart({
  title,
  data,
  valueFormatter = (value: number) => String(value),
  barColor = "var(--data-1)",
}: {
  title: string;
  data: ChartDatum[];
  valueFormatter?: (value: number) => string;
  barColor?: string;
}) {
  return (
    <figure className="rounded-lg border border-line bg-surface p-4" aria-label={title}>
      <figcaption className="h3 mb-3">{title}</figcaption>
      {data.length === 0 ? (
        <p className="body text-ink-muted">No data for this range.</p>
      ) : (
        <>
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--ink-muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={valueFormatter}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-hover)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "var(--ink)" }}
                  formatter={(value) => [valueFormatter(Number(value)), title]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {data.map((item) => (
                    <Cell key={item.label} fill={item.color ?? barColor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th>Category</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{valueFormatter(item.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
