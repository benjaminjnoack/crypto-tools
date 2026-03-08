/**
 * @param ms - milliseconds to delay
 */
export default function delay(ms: number = 1000): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
