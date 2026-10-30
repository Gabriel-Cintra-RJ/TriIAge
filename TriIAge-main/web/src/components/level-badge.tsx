import { levelStyle } from "@/lib/levels";

type Props = {
  priority: number;
  size?: "sm" | "lg";
};

export function LevelBadge({ priority, size = "sm" }: Props) {
  const level = levelStyle(priority);
  const sizing =
    size === "lg" ? "px-4 py-2 text-lg gap-3" : "px-2.5 py-1 text-sm gap-2";

  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${sizing} ${level.badge}`}
    >
      <span className="tabular-nums">{priority}</span>
      <span>
        {level.color} · {level.label}
      </span>
    </span>
  );
}
