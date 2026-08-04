export function cn(...inputs: (string | boolean | undefined | null | Record<string, boolean>)[]) {
  return inputs
    .flatMap((x) => {
      if (!x) return [];
      if (typeof x === "string") return x.split(" ");
      if (typeof x === "object") {
        return Object.entries(x)
          .filter(([_, value]) => Boolean(value))
          .map(([key]) => key);
      }
      return [];
    })
    .filter(Boolean)
    .join(" ");
}
