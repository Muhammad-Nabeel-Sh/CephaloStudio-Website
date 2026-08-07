import { useReducer, useRef, useEffect, useCallback, useState } from "react";

const SNAP_OPEN = 35;
const ANIM = "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)";

const init = { render: false, openPct: 100 };

function reducer(st, action) {
  switch (action.type) {
    case "OPEN": return { render: true, openPct: 100 };
    case "SHOW": return { render: true, openPct: SNAP_OPEN };
    case "HIDE": return { render: true, openPct: 100 };
    case "CLOSE": return { render: false, openPct: 100 };
    case "FULL": return { render: true, openPct: 5 };
    case "SET": return { ...st, openPct: action.pct };
    default: return st;
  }
}

export default function MobileBottomSheet({ t, isOpen, onClose, children }) {
  const [st, dispatch] = useReducer(reducer, init);
  const [kbH, setKbH] = useState(0);
  const sheetRef = useRef(null);
  const rootRef = useRef(null);
  const startYRef = useRef(0);
  const startPctRef = useRef(100);
  const pctRef = useRef(100);
  const rafRef = useRef(null);
  const hideTimer = useRef(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      dispatch({ type: "OPEN" });
      requestAnimationFrame(() => dispatch({ type: "SHOW" }));
    } else {
      dispatch({ type: "HIDE" });
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        dispatch({ type: "CLOSE" });
      }, 350);
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [isOpen]);

  useEffect(() => { pctRef.current = st.openPct; }, [st.openPct]);

  useEffect(() => {
    if (!st.render) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [st.render]);

  // Track the on-screen keyboard via the visual viewport so the sheet rises
  // above it instead of staying pinned under it while typing.
  useEffect(() => {
    if (!st.render) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height);
      setKbH(Math.min(inset, window.innerHeight * 0.6));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [st.render]);

  const syncState = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      dispatch({ type: "SET", pct: pctRef.current });
    });
  }, []);

  const setTranslate = useCallback((pct) => {
    const el = sheetRef.current;
    if (el) {
      const clamped = Math.max(0, Math.min(100, pct));
      pctRef.current = clamped;
      el.style.transition = "none";
      el.style.transform = `translateY(${clamped}%)`;
      syncState();
    }
  }, [syncState]);

  const animateTo = useCallback((pct) => {
    const el = sheetRef.current;
    if (el) {
      pctRef.current = pct;
      el.style.transition = ANIM;
      el.style.transform = `translateY(${pct}%)`;
      syncState();
    }
  }, [syncState]);

  const onHandlePointerDown = useCallback((e) => {
    draggingRef.current = true;
    movedRef.current = false;
    startYRef.current = e.clientY;
    startPctRef.current = pctRef.current;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  }, []);

  const onHandlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const dy = e.clientY - startYRef.current;
    if (Math.abs(dy) > 4) movedRef.current = true;
    const pct = startPctRef.current + (dy / window.innerHeight) * 100;
    setTranslate(pct);
  }, [setTranslate]);

  const onHandlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const el = sheetRef.current;
    if (!el) return;
    const current = pctRef.current;
    // Tap (no movement): toggle between collapsed (snapped) and expanded.
    if (!movedRef.current) {
      if (current <= 20) {
        dispatch({ type: "SHOW" });
        animateTo(SNAP_OPEN);
      } else {
        dispatch({ type: "FULL" });
        animateTo(5);
      }
      return;
    }
    if (current > 50) {
      animateTo(100);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        dispatch({ type: "CLOSE" });
        onClose();
      }, 300);
    } else if (current < 15) {
      dispatch({ type: "FULL" });
      animateTo(5);
    } else {
      dispatch({ type: "SHOW" });
      animateTo(SNAP_OPEN);
    }
  }, [onClose, animateTo]);

  const onBackdropClick = useCallback(() => {
    animateTo(100);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      dispatch({ type: "CLOSE" });
      onClose();
    }, 300);
  }, [onClose, animateTo]);

  if (!st.render) return null;

  const backdropOpa = Math.max(0, Math.min(1, (100 - st.openPct) / 65));

  return (
    <div ref={rootRef} style={{ position: "fixed", inset: 0, zIndex: 30, pointerEvents: "none" }}>
      <div onClick={onBackdropClick} className="mobile-chrome" style={{
        position: "absolute", inset: 0, background: `rgba(0,0,0,${0.4 * backdropOpa})`,
        opacity: backdropOpa,
        transition: "opacity 0.3s ease",
        pointerEvents: "auto",
      }}/>
      <div ref={sheetRef} className="mobile-sheet" style={{
        position: "absolute", left: 0, right: 0, bottom: kbH || 0,
        background: t.surf,
        height: kbH ? `calc(95dvh - ${kbH}px)` : undefined,
        borderRadius: "16px 16px 0 0",
        transform: `translateY(${st.openPct}%)`,
        transition: ANIM,
        willChange: "transform",
        pointerEvents: "auto",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        boxShadow: `0 -4px 24px ${t.shadow}66`,
      }}>
        <div className="mobile-chrome" style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          height: 40, width: "100%", flexShrink: 0,
          cursor: "grab", touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
        }}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: t.tx3 + "55",
          }}/>
        </div>
        <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          <div style={{ maxWidth: 960, width: "100%", margin: "0 auto" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}
