export const elide = (s: string, maxLength: number = 50): string => {
  if (s.length <= maxLength) {
    return s;
  }
  return s.slice(0, maxLength - 10) + '...' + s.slice(maxLength - 5);
}
