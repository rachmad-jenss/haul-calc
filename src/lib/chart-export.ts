import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

function isTauriContext(): boolean {
  return typeof (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined";
}

async function renderChartToCanvas(containerEl: HTMLElement): Promise<HTMLCanvasElement> {
  const svg = containerEl.querySelector("svg");
  if (!svg) throw new Error("No chart SVG found");

  const { width, height } = svg.getBoundingClientRect();
  if (!width || !height) throw new Error("Chart has zero dimensions");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  // CSS custom properties don't resolve when SVG is rendered off-document — inline them
  const cssRoot = getComputedStyle(document.documentElement);
  const resolveColor = (val: string) =>
    val.replace(/hsl\(var\((--[^)]+)\)\)/g, (_, v) => {
      const raw = cssRoot.getPropertyValue(v).trim();
      return raw ? `hsl(${raw})` : val;
    });

  clone.querySelectorAll<SVGElement>("*").forEach((el) => {
    for (const attr of ["stroke", "fill"] as const) {
      const v = el.getAttribute(attr);
      if (v) el.setAttribute(attr, resolveColor(v));
    }
  });

  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas 2D context unavailable"));
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("SVG render failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportChartToPng(
  containerEl: HTMLElement,
  defaultFilename: string,
): Promise<void> {
  const canvas = await renderChartToCanvas(containerEl);

  if (isTauriContext()) {
    const filePath = await save({
      filters: [{ name: "PNG Image", extensions: ["png"] }],
      defaultPath: `${defaultFilename}.png`,
    });
    if (!filePath) return;
    const pngBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png"),
    );
    await writeFile(filePath, new Uint8Array(await pngBlob.arrayBuffer()));
  } else {
    // Browser / test fallback: trigger a standard download
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${defaultFilename}.png`;
    a.click();
  }
}
