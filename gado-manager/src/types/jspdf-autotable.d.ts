declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  interface UserOptions {
    startY?: number | false;
    margin?: {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };
    head?: (string | number | { [key: string]: string | number })[][];
    body?: (string | number | { [key: string]: string | number })[][];
    foot?: (string | number | { [key: string]: string | number })[][];
    theme?: "striped" | "grid" | "plain" | null;
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    footStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    columnStyles?: Record<string, Record<string, unknown>>;
    styles?: Record<string, unknown>;
    tableWidth?: "auto" | "wrap" | number;
    showHead?: "everyPage" | "firstPage" | "never";
    showFoot?: "everyPage" | "lastPage" | "never";
    pageBreak?: "auto" | "avoid" | "always";
    tableLineWidth?: number;
    tableLineColor?: [number, number, number] | number | string | false;
    html?: string | HTMLTableElement;
    columns?: unknown[];
    tableId?: string | number;
  }

  function autoTable(doc: jsPDF, options: UserOptions): void;

  export default autoTable;
}
