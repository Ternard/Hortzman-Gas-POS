import { Cable, Egg, Gauge, Lightbulb, Package, Wrench } from "lucide-react";
import type { ComponentType } from "react";

export type IconType = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

/** Same line style as the Lucide icons, for things Lucide doesn't have. */
function make(children: React.ReactNode): IconType {
  return function CustomIcon({ size = 24, className, strokeWidth = 2 }) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {children}
      </svg>
    );
  };
}

/** LPG gas cylinder: handle, valve, rounded body with two bands. */
export const GasCylinder = make(
  <>
    <path d="M9 3h6" />
    <path d="M12 3v3" />
    <path d="M7 11a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
    <path d="M7 12.5h10" />
    <path d="M7 17.5h10" />
  </>
);

/** Gas burner seen from above: ring, inner cap and flame ports. */
export const Burner = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 8V4M12 16v4M8 12H4M16 12h4" />
  </>
);

/** Table-top gas stove seen from above: body with two burners and a control knob. */
export const TableStove = make(
  <>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="8" cy="11" r="3" />
    <circle cx="16" cy="11" r="3" />
    <path d="M12 16h0.01" />
  </>
);

/** Pick a picture for an item from its name/category so cashiers can recognise it at a glance. */
export function productIcon(name: string, category = ""): IconType {
  const t = (name + " " + category).toLowerCase();
  if (/egg/.test(t)) return Egg;
  if (/\bled\b|bulb|buld|light|lamp|avc/.test(t)) return Lightbulb;
  if (/stove|riko|table gas|cooker|grill/.test(t)) return TableStove;
  if (/burner/.test(t)) return Burner;
  if (/hose|pipe|cable|wire/.test(t)) return Cable;
  if (/regulator|gauge/.test(t)) return Gauge;
  if (/gas|refill|cylinder|kg/.test(t)) return GasCylinder;
  if (/valve|clip|fitting|accessor/.test(t)) return Wrench;
  return Package;
}
