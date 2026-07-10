export type Vote = "up" | "down";

export interface PlaceFeedback {
  vote: Vote;
  comment: string;
  updatedAt: string;
}

const feedbackKey = (osmType: string, osmId: number | string) =>
  `drift-feedback-${osmType}-${osmId}`;

const legacySuitabilityKey = (osmType: string, osmId: number | string) =>
  `drift-suitability-${osmType}-${osmId}`;

/** Read feedback; transparently migrates old "unsuitable" entries to a
 *  thumbs-down vote the first time they are seen, then deletes them. */
export function getFeedback(osmType: string, osmId: number | string): PlaceFeedback | null {
  try {
    const raw = localStorage.getItem(feedbackKey(osmType, osmId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.vote === "up" || parsed.vote === "down")) {
        return {
          vote: parsed.vote,
          comment: typeof parsed.comment === "string" ? parsed.comment : "",
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        };
      }
      return null;
    }
    const legacy = localStorage.getItem(legacySuitabilityKey(osmType, osmId));
    if (legacy) {
      localStorage.removeItem(legacySuitabilityKey(osmType, osmId));
      const parsed = JSON.parse(legacy);
      if (parsed && parsed.unsuitable) {
        const migrated: PlaceFeedback = {
          vote: "down",
          comment: typeof parsed.comment === "string" ? parsed.comment : "",
          updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
        };
        localStorage.setItem(feedbackKey(osmType, osmId), JSON.stringify(migrated));
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** vote=null clears the entry entirely. Returns what is now stored. */
export function setFeedback(
  osmType: string,
  osmId: number | string,
  vote: Vote | null,
  comment = ""
): PlaceFeedback | null {
  try {
    if (!vote) {
      localStorage.removeItem(feedbackKey(osmType, osmId));
      return null;
    }
    const entry: PlaceFeedback = {
      vote,
      comment: comment.trim().slice(0, 200),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(feedbackKey(osmType, osmId), JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}
