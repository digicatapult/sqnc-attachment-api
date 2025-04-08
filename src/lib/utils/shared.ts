export function trim0x(input: string): string {
  return input.startsWith('0x') ? input.slice(2) : input
}
