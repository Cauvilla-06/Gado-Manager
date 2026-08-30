"use client";

import dynamic from "next/dynamic";

export const PieChart = dynamic(
  () => import("recharts").then((mod) => mod.PieChart),
  { ssr: false }
);

export const Pie = dynamic(
  () => import("recharts").then((mod) => mod.Pie),
  { ssr: false }
);

export const Cell = dynamic(
  () => import("recharts").then((mod) => mod.Cell),
  { ssr: false }
);

export const Tooltip = dynamic(
  () => import("recharts").then((mod) => mod.Tooltip),
  { ssr: false }
);

export const ResponsiveContainer = dynamic(
  () => import("recharts").then((mod) => mod.ResponsiveContainer),
  { ssr: false, loading: () => <div className="h-64 bg-muted rounded animate-pulse" /> }
);

export const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);

export const Line = dynamic(
  () => import("recharts").then((mod) => mod.Line),
  { ssr: false }
);

export const XAxis = dynamic(
  () => import("recharts").then((mod) => mod.XAxis),
  { ssr: false }
);

export const YAxis = dynamic(
  () => import("recharts").then((mod) => mod.YAxis),
  { ssr: false }
);

export const CartesianGrid = dynamic(
  () => import("recharts").then((mod) => mod.CartesianGrid),
  { ssr: false }
);
