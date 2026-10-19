import React from "react";

export const PortfolioSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="aspect-[4/5] rounded-3xl luxury-shimmer" />
      ))}
    </div>
  );
};
