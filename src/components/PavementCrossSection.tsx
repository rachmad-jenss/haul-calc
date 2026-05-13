import type { PavementResult } from "@/lib/types";

const LAYER_COLORS = ["#1d4ed8", "#0ea5e9", "#22c55e", "#eab308", "#a16207"];

const SCALE_WIDTH = 60;
const DIAGRAM_WIDTH = 320;
const RECT_WIDTH = DIAGRAM_WIDTH - SCALE_WIDTH;
const TARGET_TOTAL_HEIGHT = 280;
const MIN_LAYER_HEIGHT = 28;

export function PavementCrossSection({ result }: { result: PavementResult }) {
  const { layers, total_thickness_mm } = result;

  const rawHeights = layers.map((l) =>
    Math.max(MIN_LAYER_HEIGHT, (l.thickness_mm / total_thickness_mm) * TARGET_TOTAL_HEIGHT)
  );
  const scaledTotal = rawHeights.reduce((a, b) => a + b, 0);

  const svgHeight = scaledTotal;
  const mmPerPx = total_thickness_mm / scaledTotal;

  let cumY = 0;
  const rects = layers.map((layer, i) => {
    const h = rawHeights[i];
    const y = cumY;
    cumY += h;
    return { layer, h, y, color: LAYER_COLORS[i % LAYER_COLORS.length] };
  });

  const tickCount = 5;
  const ticks: { y: number; label: string }[] = [];
  for (let t = 0; t <= tickCount; t++) {
    const mm = Math.round((t / tickCount) * total_thickness_mm);
    const y = mm / mmPerPx;
    ticks.push({ y, label: `${mm}` });
  }

  return (
    <div className="space-y-1">
      <svg
        width={DIAGRAM_WIDTH}
        height={svgHeight}
        viewBox={`0 0 ${DIAGRAM_WIDTH} ${svgHeight}`}
        aria-label="Pavement cross-section diagram"
      >
        {rects.map(({ layer, h, y, color }, i) => (
          <g key={i}>
            <rect
              x={SCALE_WIDTH}
              y={y}
              width={RECT_WIDTH}
              height={h}
              fill={color}
            />
            {i > 0 && (
              <line
                x1={SCALE_WIDTH}
                y1={y}
                x2={DIAGRAM_WIDTH}
                y2={y}
                stroke="white"
                strokeWidth={1.5}
              />
            )}
            <text
              x={SCALE_WIDTH + RECT_WIDTH / 2}
              y={y + h / 2 - (layer.cbr !== null ? 7 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={11}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {layer.name}
            </text>
            <text
              x={SCALE_WIDTH + RECT_WIDTH / 2}
              y={y + h / 2 + (layer.cbr !== null ? 7 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={10}
              fontFamily="monospace"
              opacity={0.9}
            >
              {layer.thickness_mm} mm{layer.cbr !== null ? ` · CBR ${layer.cbr}%` : ""}
            </text>
          </g>
        ))}

        {ticks.map(({ y, label }, i) => (
          <g key={i}>
            <line
              x1={SCALE_WIDTH - 5}
              y1={y}
              x2={SCALE_WIDTH}
              y2={y}
              stroke="#6b7280"
              strokeWidth={1}
            />
            <text
              x={SCALE_WIDTH - 7}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="#6b7280"
              fontSize={9}
              fontFamily="monospace"
            >
              {label}
            </text>
          </g>
        ))}

        <line
          x1={SCALE_WIDTH}
          y1={0}
          x2={SCALE_WIDTH}
          y2={svgHeight}
          stroke="#6b7280"
          strokeWidth={1}
        />

        <text
          x={10}
          y={svgHeight / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6b7280"
          fontSize={9}
          fontFamily="monospace"
          transform={`rotate(-90, 10, ${svgHeight / 2})`}
        >
          depth (mm)
        </text>
      </svg>
      <p className="font-mono text-xs text-muted-foreground">
        Total: {total_thickness_mm} mm
      </p>
    </div>
  );
}
