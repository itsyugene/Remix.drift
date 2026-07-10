import React from 'react';

interface PlaceCardSkeletonProps {
  borderClass: string;
}

export default function PlaceCardSkeleton({ borderClass }: PlaceCardSkeletonProps) {
  return (
    <div 
      className={`mb-3.5 border-t-4 border-solid ${borderClass} rounded-xl bg-[#fdfaf4]/90 shadow-xl p-4 flex flex-col justify-between animate-pulse`}
      aria-hidden="true"
    >
      <div className="flex justify-between items-start gap-2.5">
        {/* Title skeleton */}
        <div className="h-5 w-1/2 bg-[#e8e3d8] rounded-md" />
        {/* Distance + compass skeleton */}
        <div className="h-6 w-32 bg-[#e8e3d8] rounded-full" />
      </div>

      {/* Category/Type skeleton */}
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <div className="h-4 w-20 bg-[#e8e3d8]/80 rounded-md" />
      </div>

      {/* Opening hours text skeleton */}
      <div className="h-4 w-36 bg-[#e8e3d8]/70 rounded-md mt-2" />

      {/* Subtags skeleton */}
      <div className="h-3 w-48 bg-[#e8e3d8]/50 rounded-md mt-2" />

      {/* Divider */}
      <div className="mt-3.5 pb-3.5 border-b border-dashed border-neutral-300" />

      {/* Footer link row skeleton */}
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <div className="h-4 w-24 bg-[#e8e3d8]/80 rounded-md" />
        <div className="h-4 w-20 bg-[#e8e3d8]/80 rounded-md" />
        <div className="h-3 w-16 bg-[#e8e3d8]/50 rounded-md ml-auto" />
      </div>
    </div>
  );
}
