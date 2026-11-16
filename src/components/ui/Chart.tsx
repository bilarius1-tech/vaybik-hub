"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { cn } from "@/lib/cn";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

type Props = {
  data: ChartData<"line">;
  options?: ChartOptions<"line">;
  className?: string;
  height?: number;
};

export function Chart({ data, options, className, height = 220 }: Props) {
  const defaults: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "var(--mu)",
          font: { family: "Manrope", size: 12 },
        },
      },
      tooltip: {
        titleFont: { family: "Manrope" },
        bodyFont: { family: "Manrope" },
      },
    },
    scales: {
      x: {
        ticks: { color: "var(--mu)", font: { family: "Manrope", size: 11 } },
        grid: { color: "color-mix(in srgb, var(--bd) 50%, transparent)" },
      },
      y: {
        ticks: { color: "var(--mu)", font: { family: "Manrope", size: 11 } },
        grid: { color: "color-mix(in srgb, var(--bd) 50%, transparent)" },
      },
    },
  };

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <Line data={data} options={{ ...defaults, ...options }} />
    </div>
  );
}
