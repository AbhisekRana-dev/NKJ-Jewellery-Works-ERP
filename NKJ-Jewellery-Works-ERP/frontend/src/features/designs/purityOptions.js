export const PURITY_OPTIONS = Object.freeze({
  GOLD: ["24K", "hallmark(916)", "22K"],
  SILVER: ["999 Silver", "925 Silver", "900 Silver", "800 Silver"],
  DIAMOND: ["Natural Diamond", "Lab-Grown Diamond"],
});

export function getPurityOptions(metalType) {
  return PURITY_OPTIONS[String(metalType || "").trim().toUpperCase()] || [];
}

export function isPurityAllowed(metalType, purity) {
  const value = String(purity || "").trim();
  return !value || getPurityOptions(metalType).some(
    (option) => option.toLowerCase() === value.toLowerCase(),
  );
}
