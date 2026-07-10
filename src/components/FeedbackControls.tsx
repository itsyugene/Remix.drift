import { useState } from 'react';
import { getFeedback, setFeedback, type PlaceFeedback, type Vote } from "../lib/feedback.ts";

interface Props {
  osmType: string;
  osmId: number | string;
  placeName: string;
  onChange?: () => void; // notify the list so ranking can update
}

export function FeedbackControls({ osmType, osmId, placeName, onChange }: Props) {
  const [feedback, setFb] = useState<PlaceFeedback | null>(() => getFeedback(osmType, osmId));
  const [draft, setDraft] = useState(feedback?.comment ?? "");

  const castVote = (vote: Vote) => {
    const next = feedback?.vote === vote ? null : vote; // same thumb again = clear
    const stored = setFeedback(osmType, osmId, next, next ? draft : "");
    setFb(stored);
    if (!stored) setDraft("");
    onChange?.();
  };

  const saveComment = () => {
    if (!feedback) return;
    setFb(setFeedback(osmType, osmId, feedback.vote, draft));
  };

  const thumbBase =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[0.66rem] font-mono font-bold uppercase tracking-wide transition-colors cursor-pointer";

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-[#d8d2bf]">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => castVote("up")}
          aria-pressed={feedback?.vote === "up"}
          aria-label={`Thumbs up for ${placeName}`}
          className={`${thumbBase} ${
            feedback?.vote === "up"
              ? "border-[#1f8a4c] bg-[#e2f2e8] text-[#1f8a4c]"
              : "border-[#d3ceb7] text-[#7a7e8d] hover:border-[#1f8a4c] hover:text-[#1f8a4c]"
          }`}
        >
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
          Good drift
        </button>
        <button
          type="button"
          onClick={() => castVote("down")}
          aria-pressed={feedback?.vote === "down"}
          aria-label={`Thumbs down for ${placeName}`}
          className={`${thumbBase} ${
            feedback?.vote === "down"
              ? "border-[#b3402f] bg-[#f7e2dc] text-[#b3402f]"
              : "border-[#d3ceb7] text-[#7a7e8d] hover:border-[#b3402f] hover:text-[#b3402f]"
          }`}
        >
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>
          Skip it
        </button>
        <span className="text-[0.62rem] font-mono text-[#a39e8b]">this device only</span>
      </div>

      {feedback && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveComment}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          maxLength={200}
          placeholder={feedback.vote === "down" ? "Why skip? e.g. construction, closed down..." : "What made it good? (optional)"}
          aria-label={`Optional comment about ${placeName}`}
          className="mt-2 w-full rounded-lg border border-[#d3ceb7] bg-white px-2.5 py-2 text-[0.82rem] text-[#12131a] outline-none focus:border-[#b3402f]"
        />
      )}
    </div>
  );
}
