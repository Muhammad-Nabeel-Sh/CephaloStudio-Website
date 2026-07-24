import { uid } from "../utils.js";
import { logError } from "../logger.js";

export function loadImageFile(file, addToStack, { sessionImages, dispatch, updSession, imgRefs, canvasSize, panRef }) {
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 100 * 1024 * 1024) {
    alert(`"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum image size is 100 MB.`);
    return;
  }
  dispatch({ type: "SET", payload: { loadingImages: true } });
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const img = new Image();
    img.onload = () => {
      const id = uid();
      imgRefs.current[id] = img;
      const entry = { id, name: file.name, dataUrl, dx: 0, dy: 0, opacity: 1, blendMode: "normal", visible: true, color: "none", transform: { tx: 0, ty: 0, rot: 0, scale: 1 } };
      const currentImages = sessionImages || [];
      if (addToStack) {
        updSession({ images: [...currentImages, entry] });
      } else {
        updSession({ images: [entry] });
      }
      dispatch({ type: "SET", payload: { loadingImages: false } });
      if (!addToStack) {
        const cw = canvasSize.current.w - 80, ch = canvasSize.current.h - 80;
        const sc = Math.min(cw / (img.naturalWidth || 600), ch / (img.naturalHeight || 500), 1);
        dispatch({ type: "SET", payload: { zoom: sc } });
        panRef.current = { x: 40, y: 40 };
        dispatch({ type: "SET", payload: { pan: { x: 40, y: 40 } } });
        updSession({ calibration: { done: false, pxPerMm: 1, knownMm: "" } });
      }
    };
    img.onerror = () => {
      dispatch({ type: "SET", payload: { loadingImages: false } });
      logError("Image decode failed:", null);
      alert(`Could not decode "${file?.name || "image"}". The file may be corrupt or in an unsupported format.`);
    };
    img.src = dataUrl;
  };
  reader.onerror = () => {
    dispatch({ type: "SET", payload: { loadingImages: false } });
    logError("File read failed:", reader.error);
    alert(`Could not read "${file?.name || "file"}".`);
  };
  reader.readAsDataURL(file);
}

export function handleImageDrop(e, loadImageFn) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
  files.forEach((f, i) => loadImageFn(f, i > 0));
}
