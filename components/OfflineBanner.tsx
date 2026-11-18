"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Tells the cashier plainly when the internet is down, so a failed save isn't a mystery. */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (!offline) return null;
  return (
    <div className="no-print sticky top-[57px] z-20 flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
      <WifiOff size={16} /> No internet. Sales can't be saved until it comes back.
    </div>
  );
}
