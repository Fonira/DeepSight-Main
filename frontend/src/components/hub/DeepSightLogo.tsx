// frontend/src/components/hub/DeepSightLogo.tsx
import React from "react";

interface Props {
  size?: number;
  alt?: string;
  className?: string;
}

export const DeepSightLogo: React.FC<Props> = ({
  size = 36,
  alt = "DeepSight",
  className,
}) => {
  return (
    <div
      className={"relative shrink-0 " + (className ?? "")}
      style={{ width: size, height: size }}
      aria-hidden="false"
    >
      <div
        aria-hidden="true"
        className="absolute -inset-[3px] rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, #06b6d4, #6366f1, #8b5cf6, #ef4444, #f59e0b, #10b981, #06b6d4)",
          filter: "blur(6px)",
          opacity: 0.55,
          zIndex: 0,
        }}
      />
      <img
        src="/deepsight-logo-cosmic.png"
        alt={alt}
        width={size}
        height={size}
        className="relative z-[1] rounded-full object-cover"
        style={{
          width: size,
          height: size,
          boxShadow:
            "0 4px 16px rgba(0,0,0,.5), inset 0 0 0 1px rgba(99,102,241,.15)",
        }}
      />
    </div>
  );
};
