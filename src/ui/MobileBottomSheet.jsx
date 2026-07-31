import { useReducer, useRef, useEffect, useCallback } from "react";

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
    default: return st;
  }
}

export default function MobileBottomSheet({ t, isOpen, onClose, children }) {
  const [st, dispatch] = useReducer(reducer, init);
  const sheetRef = useRef(null);
  const rootRef = useRef(null);
  const startYRef = useRef(0);
  const startPctRef = useRef(100);
  const hideTimer = useRef(null);

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

  const setTranslate = useCallback((pct) => {
    const el = sheetRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.transform = `translateY(${Math.max(0, Math.min(100, pct))}%)`;
    }
  }, []);

  const animateTo = useCallback((pct) => {
    const el = sheetRef.current;
    if (el) {
      el.style.transition = ANIM;
      el.style.transform = `translateY(${pct}%)`;
    }
  }, []);

  const onHandleTouchStart = useCallback((e) => {
    startYRef.current = e.touches[0].clientY;
    startPctRef.current = st.openPct;
  }, [st.openPct]);

  const onHandleTouchMove = useCallback((e) => {
    const dy = e.touches[0].clientY - startYRef.current;
    const pct = startPctRef.current + (dy / window.innerHeight) * 100;
    setTranslate(pct);
  }, [setTranslate]);

  const onHandleTouchEnd = useCallback(() => {
    const el = sheetRef.current;
    if (!el) return;
    const match = el.style.transform.match(/translateY\(([\d.]+)%\)/);
    const current = match ? parseFloat(match[1]) : st.openPct;
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
  }, [st.openPct, onClose, animateTo]);

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
      <div onClick={onBackdropClick} style={{
        position: "absolute", inset: 0, background: `rgba(0,0,0,${0.4 * backdropOpa})`,
        opacity: backdropOpa,
        transition: "opacity 0.3s ease",
        pointerEvents: "auto",
      }}/>
      <div ref={sheetRef} style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        height: "95vh", background: t.surf,
        borderRadius: "16px 16px 0 0",
        transform: `translateY(${st.openPct}%)`,
        transition: ANIM,
        pointerEvents: "auto",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: `0 -4px 24px ${t.shadow}66`,
      }}
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
      >
        <div style={{
          display: "flex", justifyContent: "center", padding: "8px 0 2px",
          cursor: "grab", touchAction: "none", flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: t.tx3 + "55",
          }}/>
        </div>
        <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
