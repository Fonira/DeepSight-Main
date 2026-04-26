import React from "react";

export interface RecentAnalysis {
  id: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  createdAt: string;
}

interface Props {
  recents: RecentAnalysis[];
  onSelect: (recent: RecentAnalysis) => void;
}

export function RecentsList({ recents, onSelect }: Props): JSX.Element {
  if (recents.length === 0) {
    return (
      <div style={{ padding: 16, opacity: 0.6, fontSize: 13 }}>
        Aucune analyse récente
      </div>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {recents.map((r) => (
        <li
          key={r.id}
          onClick={() => onSelect(r)}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            display: "flex",
            gap: 8,
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {r.thumbnail && (
            <img
              src={r.thumbnail}
              alt=""
              style={{
                width: 60,
                height: 34,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          )}
          <span style={{ fontSize: 13 }}>{r.title}</span>
        </li>
      ))}
    </ul>
  );
}
