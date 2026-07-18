export function getDefaultStatusColorAndWeight(
  name: string,
  category: string,
): { color: string; progressWeight: number } {
  const normalizedName = name.toLowerCase();
  const normalizedCategory = category.toLowerCase();

  let color = "#3b82f6"; // Default Blue
  let progressWeight = 0;

  if (
    normalizedCategory === "done" ||
    normalizedName.includes("done") ||
    normalizedName.includes("live") ||
    normalizedName.includes("finished") ||
    normalizedName.includes("completed")
  ) {
    color = "#10b981"; // Emerald green
    progressWeight = 100;
  } else if (
    normalizedCategory === "backlog" ||
    normalizedName.includes("backlog") ||
    normalizedName.includes("ideas pool")
  ) {
    color = "#ef4444"; // Red (Danger)
    progressWeight = 0;
  } else if (
    normalizedCategory === "in_progress" ||
    normalizedName.includes("progress") ||
    normalizedName.includes("creation") ||
    normalizedName.includes("active")
  ) {
    if (
      normalizedName.includes("review") ||
      normalizedName.includes("qa") ||
      normalizedName.includes("testing") ||
      normalizedName.includes("awaiting approval")
    ) {
      color = "#f59e0b"; // Amber/yellow-orange
      progressWeight = 80;
    } else {
      color = "#8b5cf6"; // Purple
      progressWeight = 50;
    }
  } else {
    // category is todo
    color = "#3b82f6"; // Blue
    progressWeight = 0;
  }

  return { color, progressWeight };
}
