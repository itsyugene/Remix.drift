import React from 'react';

interface PlaceCardSkeletonProps {
  borderClass: string;
}

export default function PlaceCardSkeleton({ borderClass }: PlaceCardSkeletonProps) {
  return (
    <div 
      className={`mb-3.5 border border-[#25293A] rounded-[10px] bg-[#090A10] p-4 flex flex-col justify-between animate-pulse`}
      aria-hidden="true"
    >
      <div className="flex justify-between items-start gap-2.5">
        <div className="h-5 w-1/2 bg-[#25293A] rounded-md" />
        <div className="h-6 w-32 bg-[#25293A] rounded-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <div className="h-4 w-20 bg-[#25293A]/80 rounded-md" />
      </div>
      <div className="h-4 w-36 bg-[#25293A]/70 rounded-md mt-2" />
      <div className="h-3 w-48 bg-[#25293A]/50 rounded-md mt-2" />
      <div className="mt-3.5 pb-3.5 border-b border-dashed border-[#25293A]" />
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <div className="h-4 w-24 bg-[#25293A]/80 rounded-md" />
        <div className="h-4 w-20 bg-[#25293A]/80 rounded-md" />
        <div className="h-3 w-16 bg-[#25293A]/50 rounded-md ml-auto" />
      </div>
    </div>
  );
}
