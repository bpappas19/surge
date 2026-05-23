import { Zap } from "lucide-react";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg";
}

const sizes = {
  xs: { box: "p-1",    icon: "w-3.5 h-3.5", text: "text-base  tracking-tight" },
  sm: { box: "p-1.5",  icon: "w-4   h-4",   text: "text-lg    tracking-tight" },
  md: { box: "p-1.5",  icon: "w-5   h-5",   text: "text-2xl   tracking-tight" },
  lg: { box: "p-2",    icon: "w-7   h-7",   text: "text-4xl   tracking-tight" },
};

export default function Logo({ size = "md" }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2">
      <div className={`bg-green-500 rounded-lg ${s.box} flex-shrink-0`}>
        <Zap className={`${s.icon} text-black`} fill="currentColor" strokeWidth={0} />
      </div>
      <span className={`font-black text-white uppercase ${s.text}`}>Surge</span>
    </div>
  );
}
