const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export function formatUnixSeconds(seconds: number): string {
  return `${dateFormatter.format(new Date(seconds * 1000))} UTC`;
}

export function formatDateOnly(seconds: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(seconds * 1000)
  );
}
