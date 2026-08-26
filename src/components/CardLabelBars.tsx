import type { Label } from "@/lib/types";
import { labelBarClass, labelColorName } from "@/lib/card-appearance";

export function CardLabelBars({ labels }: { labels: Label[] }) {
  if (!labels?.length) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-1" aria-label="Etiquetas">
      {labels.map((label) => {
        const name = label.name?.trim() || labelColorName(label.color);
        return (
          <span
            key={label.id}
            title={name}
            className={`h-2 w-10 rounded-sm ${labelBarClass(label.color)}`}
          >
            <span className="sr-only">{name}</span>
          </span>
        );
      })}
    </div>
  );
}
