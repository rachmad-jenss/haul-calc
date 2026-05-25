import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CesaResult, PavementResult, CostComparison, PavementLayer } from "@/lib/types";
import { computeBoq } from "@/lib/boq";
import type { BoqGeometry, DisplayCurrency } from "@/lib/store";
import { formatMoneyFromUsd } from "@/lib/utils";

export interface IncludeSections {
  cesa: boolean;
  cbr: boolean;
  trh14: boolean;
  cost: boolean;
  boq: boolean;
  chartOpex: boolean;
  chartLccaCumulative: boolean;
}

export const DEFAULT_SECTIONS: IncludeSections = {
  cesa: true,
  cbr: true,
  trh14: true,
  cost: true,
  boq: true,
  chartOpex: true,
  chartLccaCumulative: true,
};

export interface PdfChartImages {
  opex?: string;
  lccaCumulative?: string;
}

export interface PdfData {
  projectName: string;
  authorName: string;
  generatedAt: string;
  cesaResult: (CesaResult & { stub?: boolean }) | null;
  cbrResult: (PavementResult & { stub?: boolean }) | null;
  trhResult: (PavementResult & { stub?: boolean }) | null;
  costResult: (CostComparison & { stub?: boolean }) | null;
  boqGeometry?: BoqGeometry;
  boqLayers?: PavementLayer[];
  includeSections?: IncludeSections;
  currency?: DisplayCurrency;
  usdToIdrRate?: number;
  chartImages?: PdfChartImages;
}

const COLORS = {
  primary: [15, 23, 42] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  headerBg: [241, 245, 249] as [number, number, number],
};

function addPageNumbers(doc: jsPDF): void {
  const total = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Page ${i} of ${total}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" },
    );
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(title.toUpperCase(), 14, y);
  doc.setDrawColor(...COLORS.muted);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1.5, doc.internal.pageSize.getWidth() - 14, y + 1.5);
  return y + 8;
}

function keyValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(`${label}:`, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(value, 55, y);
  return y + 6;
}

function currentY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY?: number } }).lastAutoTable?.finalY ?? 0;
}

function ensureSpace(doc: jsPDF, y: number, neededMm: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + neededMm > pageH - 16) {
    doc.addPage();
    return 20;
  }
  return y;
}

function embedChartImage(
  doc: jsPDF,
  title: string,
  dataUrl: string,
  y: number,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const imgW = pageW - 2 * margin;
  const imgH = imgW * 0.42;
  y = ensureSpace(doc, y, imgH + 14);
  y = sectionTitle(doc, title, y);
  doc.addImage(dataUrl, "JPEG", margin, y, imgW, imgH);
  return y + imgH + 8;
}

export function generatePdf(data: PdfData): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("HAUL ROAD PAVEMENT DESIGN REPORT", pageW / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.primary);
  doc.text(data.projectName, pageW / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  const meta = [
    data.authorName ? `Author: ${data.authorName}` : null,
    `Generated: ${data.generatedAt}`,
  ]
    .filter(Boolean)
    .join("   |   ");
  doc.text(meta, pageW / 2, y, { align: "center" });
  y += 12;

  const inc = { ...DEFAULT_SECTIONS, ...data.includeSections };

  // CESA Analysis
  if (data.cesaResult && inc.cesa) {
    y = sectionTitle(doc, "CESA Analysis", y);
    y = keyValue(doc, "CESA", data.cesaResult.cesa.toLocaleString("en-US", { maximumFractionDigits: 0 }), y);
    y = keyValue(doc, "Design Coverages", data.cesaResult.design_coverages.toLocaleString("en-US", { maximumFractionDigits: 0 }), y);
    y = keyValue(doc, "Design Life", `${data.cesaResult.design_life_years} years`, y);
    y += 2;

    if (data.cesaResult.axle_load_distribution.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [["Axle Load (kN)", "Passes"]],
        body: data.cesaResult.axle_load_distribution.map((r) => [
          r.axle_kn.toFixed(1),
          r.passes.toLocaleString("en-US"),
        ]),
        headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      y = currentY(doc) + 10;
    }
  }

  // CBR Thickness (USACE)
  if (data.cbrResult && inc.cbr) {
    y = sectionTitle(doc, "CBR Thickness (USACE)", y);
    y = keyValue(doc, "Method", data.cbrResult.method, y);
    y = keyValue(doc, "Total Thickness", `${data.cbrResult.total_thickness_mm} mm`, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Layer", "Thickness (mm)", "CBR (%)"]],
      body: data.cbrResult.layers.map((l) => [
        l.name,
        l.thickness_mm.toString(),
        l.cbr != null ? l.cbr.toString() : "—",
      ]),
      headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = currentY(doc) + 10;
  }

  // TRH 14 Thickness
  if (data.trhResult && inc.trh14) {
    y = sectionTitle(doc, "TRH 14 Thickness", y);
    y = keyValue(doc, "Method", data.trhResult.method, y);
    y = keyValue(doc, "Total Thickness", `${data.trhResult.total_thickness_mm} mm`, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Layer", "Thickness (mm)", "CBR (%)"]],
      body: data.trhResult.layers.map((l) => [
        l.name,
        l.thickness_mm.toString(),
        l.cbr != null ? l.cbr.toString() : "—",
      ]),
      headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = currentY(doc) + 10;
  }

  // Operating Cost Comparison
  if (data.costResult && inc.cost) {
    y = sectionTitle(doc, "Operating Cost Comparison", y);

    const currency = data.currency ?? "USD";
    const rate = data.usdToIdrRate ?? 1;
    const fmt = (v: number) => formatMoneyFromUsd(v, currency, rate);

    autoTable(doc, {
      startY: y,
      head: [["Scenario", "Tire Cost/yr", "Fuel Cost/yr", "Maintenance/yr", "Total/yr"]],
      body: data.costResult.scenarios.map((s) => {
        const total = s.tire_cost_usd_per_year + s.fuel_cost_usd_per_year + s.maintenance_cost_usd_per_year;
        return [
          s.name,
          fmt(s.tire_cost_usd_per_year),
          fmt(s.fuel_cost_usd_per_year),
          fmt(s.maintenance_cost_usd_per_year),
          fmt(total),
        ];
      }),
      headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = currentY(doc) + 10;
  }

  if (data.chartImages?.opex && inc.chartOpex) {
    y = embedChartImage(doc, "Operating Cost Comparison Chart", data.chartImages.opex, y);
  }

  if (data.chartImages?.lccaCumulative && inc.chartLccaCumulative) {
    embedChartImage(doc, "LCCA Cumulative Present Value", data.chartImages.lccaCumulative, y);
  }

  // Material BoQ
  if (data.boqLayers && data.boqGeometry && data.boqLayers.length > 0 && inc.boq) {
    doc.addPage();
    y = 20;
    y = sectionTitle(doc, "Material Bill of Quantities", y);
    y = keyValue(doc, "Road Length", `${data.boqGeometry.roadLengthKm} km`, y);
    y = keyValue(doc, "Road Width", `${data.boqGeometry.roadWidthM} m`, y);
    y = keyValue(doc, "Shoulder Width", `${data.boqGeometry.shoulderWidthM} m/side`, y);
    y += 4;

    const boqRows = computeBoq(data.boqLayers, data.boqGeometry);
    autoTable(doc, {
      startY: y,
      head: [["Layer", "Thickness (mm)", "Area (m²)", "Volume (m³)", "Density (t/m³)", "Mass (t)"]],
      body: boqRows.map((r) => [
        r.layer,
        r.thicknessMm.toFixed(0),
        r.areaM2.toFixed(1),
        r.volumeM3.toFixed(1),
        r.densityTm3.toFixed(1),
        r.massT.toFixed(1),
      ]),
      headStyles: { fillColor: COLORS.headerBg, textColor: COLORS.primary, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
  }

  addPageNumbers(doc);

  return doc.output("blob");
}
