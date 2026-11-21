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
import { useChartPalette } from "@/lib/chart-theme";
import { useMemo } from "react";

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

export function Chart<T extends ChartType = "line">({
  type = "line" as T,
  data,
  options,
  className,
  height = 220,
}: Props<T>) {
  const palette = useChartPalette();

  const defaults = useMemo((): ChartOptions => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: {
            color: palette.muted,
            font: { family: "Manrope", size: 12 },
            usePointStyle: true,
            pointStyle: "circle",
            padding: 14,
          },
        },
        tooltip: {
          titleFont: { family: "Manrope" },
          bodyFont: { family: "Manrope" },
          backgroundColor: palette.card,
          titleColor: palette.tx,
          bodyColor: palette.muted,
          borderColor: palette.bd,
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: {
            color: palette.muted,
            font: { family: "Manrope", size: 11 },
            maxRotation: 0,
          },
          grid: { color: palette.grid, drawBorder: false },
          border: { display: false },
        },
        y: {
          ticks: {
            color: palette.muted,
            font: { family: "Manrope", size: 11 },
            padding: 6,
          },
          grid: { color: palette.grid, drawBorder: false },
          border: { display: false },
        },
      },
    };
  }, [palette]);

  const merged = { ...defaults, ...options } as ChartOptions<T>;

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      {type === "bar" ? (
        <Bar
          data={data as ChartData<"bar">}
          options={merged as ChartOptions<"bar">}
        />
      ) : type === "doughnut" ? (
        <Doughnut
          data={data as ChartData<"doughnut">}
          options={
            {
              ...merged,
              scales: undefined,
              cutout: "62%",
            } as ChartOptions<"doughnut">
          }
        />
      ) : (
        <Line
          data={data as ChartData<"line">}
          options={merged as ChartOptions<"line">}
        />
      )}
    </div>
  );
}
