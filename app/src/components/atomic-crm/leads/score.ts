/**
 * Highest score the research robot can give: +2 no chat tool, +2 slow-reply complaint,
 * +1 lead marketplaces, +1 owner named, +1 ads running 6+ months
 * (lead-gen/us-discovery/tested-steps/p2_score.py, lead-gen/robot/research.py `score`).
 */
export const SCORE_MAX = 7;

export function scoreFit(score: number) {
  if (score >= 4) return { label: "Strong fit", tone: "bg-lime text-lime-foreground" };
  if (score >= 2) return { label: "Worth a try", tone: "bg-warn-soft text-warn" };
  return { label: "Weak fit", tone: "bg-muted text-muted-foreground" };
}

/** "+2 no chat/text tool; -1 mid-value type" → [{ points: 2, reason: "No chat/text tool" }, …] */
export function scoreReasons(scoreWhy?: string | null) {
  return (scoreWhy ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^([+-]?\d+)\s+(.*)$/.exec(part);
      const reason = match ? match[2] : part;
      return {
        points: match ? Number(match[1]) : null,
        reason: reason.charAt(0).toUpperCase() + reason.slice(1),
      };
    });
}
