export const parseStack = (stack?: string) => {
  if (!stack) return null;

  const lines = stack.split("\n");

  const target = lines[1] || "";

  const match = target.match(/\((.*):(\d+):(\d+)\)/);

  if (!match) return null;

  return {
    file: match[1],
    line: Number(match[2]),
    column: Number(match[3]),
  };
};
