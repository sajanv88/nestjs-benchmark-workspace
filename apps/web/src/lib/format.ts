// The locale and time zone are written out: the server and the browser have to produce the
// same text for one page.
const fullNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const shortNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const multipleNumber = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export const formatRps = (value: number): string => fullNumber.format(value);
export const formatRpsShort = (value: number): string => shortNumber.format(value);
export const formatMultiple = (value: number): string => `${multipleNumber.format(value)}×`;
export const formatDateTime = (iso: string): string => `${dateTime.format(new Date(iso))} UTC`;

export function formatMemory(bytes: number): string {
  return `${fullNumber.format(bytes / 1024 / 1024)} MB`;
}
