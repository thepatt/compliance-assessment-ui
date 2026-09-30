import type { Control } from "../types";

export function groupControls(controls: Control[]): Array<[string, Array<[string, Control[]]>]> {
  const domains = new Map<string, Map<string, Control[]>>();
  controls.forEach((control) => {
    const standards = domains.get(control.domain) ?? new Map<string, Control[]>();
    const items = standards.get(control.standard) ?? [];
    items.push(control);
    standards.set(control.standard, items);
    domains.set(control.domain, standards);
  });
  return Array.from(domains, ([domain, standards]) => [domain, Array.from(standards)]);
}
