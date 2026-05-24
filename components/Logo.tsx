import { Zap } from "lucide-react";

type Size = "xs" | "sm" | "md" | "lg";

const sizes: Record<Size, { zap: string; text: string; gap: string }> = {
  xs: { zap: "w-3.5 h-3.5", text: "text-sm   font-bold tracking-[-0.02em]", gap: "gap-1.5" },
  sm: { zap: "w-4   h-4",   text: "text-base  font-bold tracking-[-0.02em]", gap: "gap-2" },
  md: { zap: "w-5   h-5",   text: "text-xl    font-bold tracking-[-0.02em]", gap: "gap-2" },
  lg: { zap: "w-6   h-6",   text: "text-3xl   font-bold tracking-[-0.03em]", gap: "gap-2.5" },
};

export default function Logo({ size = "md" }: { size?: Size }) {
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.gap} select-none`}>
      <Zap className={`${s.zap} text-emerald-400 flex-shrink-0`} fill="currentColor" strokeWidth={0} />
      <span className={`${s.text} text-white`}>Surge</span>
    </div>
  );
}
