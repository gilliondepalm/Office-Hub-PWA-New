import { useState, useEffect } from "react";

const STORAGE_KEY = "kd_mobile_mode";

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("mobile") === "1") {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    return true;
  }
  if (params.get("mobile") === "0") {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return false;
  }

  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {}

  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as any).standalone === true) return true;

  if (/Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent)) return true;

  return window.innerWidth < 768;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectMobile);

  useEffect(() => {
    setIsMobile(detectMobile());

    const onResize = () => setIsMobile(detectMobile());
    window.addEventListener("resize", onResize);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMq = () => setIsMobile(detectMobile());
    mq.addEventListener("change", onMq);

    return () => {
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  return isMobile;
}
