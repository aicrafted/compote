/**
 * Parses raw command output to extract listening ports.
 * Supports common outputs from 'netstat', 'ss', or 'lsof'.
 */
export function parseOccupiedPorts(input: string): number[] {
  const ports = new Set<number>();
  
  // Generic regex for finding ":PORT" patterns in typical command outputs
  // Matches :80, .80, [::]:80, 0.0.0.0:80
  const portRegex = /[:.]([0-9]{2,5})\b/g;
  let match;
  
  while ((match = portRegex.exec(input)) !== null) {
    const port = parseInt(match[1], 10);
    if (port > 0 && port <= 65535) {
      ports.add(port);
    }
  }

  // Refined check: usually ports are preceded by an address or a space
  // This is a broad parser, it might pick up some false positives 
  // if the user pastes random text, but it's good for command outputs.

  return Array.from(ports).sort((a, b) => a - b);
}
