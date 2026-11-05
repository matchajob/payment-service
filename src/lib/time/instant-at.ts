import { wallClockIn, type WallClock } from '@/lib/time/wall-clock';

const wallClockAsUtc = ({ year, monthIndex, day, hour, minute, second, millisecond }: WallClock): number =>
  Date.UTC(year, monthIndex, day, hour, minute, second, millisecond);

const offsetAt = (instantMs: number, timeZone: string): number =>
  wallClockAsUtc(wallClockIn(new Date(instantMs), timeZone)) - instantMs;

export const instantAt = (wall: WallClock, timeZone: string): Date => {
  const asUtc = wallClockAsUtc(wall);
  const firstGuess = asUtc - offsetAt(asUtc, timeZone);
  return new Date(asUtc - offsetAt(firstGuess, timeZone));
};
