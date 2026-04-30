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
            "conic-gradient(from 0deg, #c48b7c, #c8903a, #d4a054, #f59e0b, #ef4444, #9b6b4a, #c48b7c)",
          filter: "blur(6px)",
          opacity: 0.65,
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
            "0 4px 16px rgba(0,0,0,.5), inset 0 0 0 1px rgba(212,160,84,.15)",
        }}
      />
    </div>
  );
};
