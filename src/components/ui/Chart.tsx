"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { cn } from "@/lib/cn";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

type Props<T extends ChartType = "line"> = {
  type?: T;
  data: ChartData<T>;
  options?: ChartOptions<T>;
  className?: string;
  height?: number;
};

function baseOptions(): ChartOptions {
  return {
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
}

export function Chart<T extends ChartType = "line">({
  type = "line" as T,
  data,
  options,
  className,
  height = 220,
}: Props<T>) {
  const defaults = baseOptions();
  const merged = { ...defaults, ...options } as ChartOptions<T>;

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      {type === "bar" ? (
        <Bar data={data as ChartData<"bar">} options={merged as ChartOptions<"bar">} />
      ) : type === "doughnut" ? (
        <Doughnut
          data={data as ChartData<"doughnut">}
          options={
            {
              ...merged,
              scales: undefined,
            } as ChartOptions<"doughnut">
          }
        />
      ) : (
        <Line data={data as ChartData<"line">} options={merged as ChartOptions<"line">} />
      )}
    </div>
  );
}
