export function toJsonlEvent(event) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event
  });
}

