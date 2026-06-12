# CephaloStudio Codebase & Feature Audit

Based on a thorough review of your codebase, particularly focusing on the recent additions (sessions, study designs, statistical analyses, charts, normograms, and silhouettes), here is a comprehensive critique outlining what works well and what needs improvement.

## 1. Statistical Analyses (`src/research/*.js`)

The statistical implementation is highly ambitious and covers an impressive breadth of analyses (Reliability, Descriptive, Comparative, Longitudinal).

### 🟢 Strengths
- **Comprehensive Coverage:** You've implemented non-parametric alternatives (Mann-Whitney, Kruskal-Wallis, Friedman) and parametric tests (ANOVA, Welch's t-test) elegantly with automatic fallback logic based on assumption testing.
- **Robust Selection Logic:** The `selectAndRunTest` functions nicely automate test selection based on Shapiro-Wilk normality and Levene's equal variance tests.
- **Effect Sizes:** Calculating effect sizes automatically (Cohen's d, partial $\eta^2$, Kendall's W) adds significant clinical/research value.

### 🔴 Areas for Improvement & Risks
- **Approximated Math:** You are using custom implementations for complex statistical functions like `fCDF`, `tDistributeCDF`, and `normalCdf` (using the Abramowitz & Stegun approximation). While functional, home-grown statistical functions are prone to floating-point precision issues, especially at the extremes (e.g., very small p-values). 
  > [!WARNING]
  > For a medical/research tool, consider offloading these to an established library (like `jstat` or `@stdlib/stats`) to guarantee peer-review-grade accuracy.
- **Mauchly's Sphericity & Sphericity Corrections:** The implementation in `longitudinal.js` for Greenhouse-Geisser and Huynh-Feldt is a great feature, but matrix inversion and covariance calculation on small samples without regularization can lead to singular matrices and `null` returns.
- **Missing Edge-Case Handling:** In `matInverse` (used in MANOVA and LMM), you check for `Math.abs(aug[col][col]) < 1e-12` and return `null`. If a user inputs highly correlated variables, the entire MANOVA will fail silently or return skipped rather than providing collinearity warnings.
- **Bonferroni / BH Multi-comparison:** You are adjusting $p$-values, but the results should ideally present both adjusted and unadjusted $p$-values clearly in the UI so researchers know exactly what correction was applied.

## 2. Charts & Visualizations (`moduleCharts.jsx` & `NormogramPanel.jsx`)

You've built a custom SVG charting library from scratch.

### 🟢 Strengths
- **Aesthetic Excellence:** The custom SVGs (Polygon, Wiggle, Radar, Forest plots, Volcano plots) are beautifully tailored to cephalometric needs. The Wiggle chart and Radar chart in `NormogramPanel.jsx` are highly specific and well-executed for this domain.
- **No Heavy Dependencies:** You avoided pulling in massive libraries like Chart.js or D3, keeping the bundle size down and rendering fast.

### 🔴 Areas for Improvement
- **Interactivity:** Because these are pure SVG paths, they lack interactive features that researchers love (e.g., hovering over a point in a scatter/Bland-Altman plot to see exactly which session/patient it corresponds to). 
  > [!TIP]
  > You can add simple `<title>` tags inside your SVG `<circle>` elements to get native browser tooltips without rewriting the whole chart engine.
- **Hardcoded Dimensions:** Many charts have hardcoded widths (`W = 600`, `H = ...`) and use `viewBox` to scale. On ultra-wide monitors or split views, the text may become disproportionately large or small. Use responsive SVG techniques and `clamp()` for text sizing inside SVGs.
- **Performance with Large Data:** In the Bland-Altman and Trajectory charts, drawing thousands of SVG nodes can degrade DOM performance. If studies scale up to hundreds of cases, you might experience lag. 

## 3. Sessions & Study Designs (`studyModel.js`, `project.js`)

### 🟢 Strengths
- **Flexible Data Model:** The shift to a Sessions-based model instead of raw DB records is smart. It fits the paradigm of "Patient -> Timepoint/Condition -> Session".
- **Sanitization on Export:** Your `sanitizeResults` in `App.jsx` handles stripping out heavy `dataUrl` strings from research results to keep `.cephx` files small.

### 🔴 Areas for Improvement
- **Memory Management (Bloat):** Sessions keep full base64 images (`dataUrl`) in memory. If a user loads 50 high-res lateral cephs, the browser memory will easily exceed 1-2GB, leading to crash-loops. 
  > [!CAUTION]
  > Consider using `URL.createObjectURL(blob)` instead of base64 `dataUrl` strings for session images in memory. Only convert to base64 during the `.cephx` export phase.
- **Study Engine Mutability:** `engine.js` runs synchronously. If a dataset is large, running an LMM or MANOVA on the main thread will block the UI and freeze the app. Consider moving `runStudy` to a WebWorker.

## 4. Silhouettes & Anatomy (`silhouettes.js`)

### 🟢 Strengths
- **Jacobson Method Alignment:** Accurate predefined outlines based on classic cephalometric templates.
- **Coordinate System:** Normalized coordinates `[-0.5 ... 0.5]` is excellent for resolution independence and scaling based on calibration data.

### 🔴 Areas for Improvement
- **Hit Testing & Interaction:** The silhouettes are currently rendered as static overlays. It's difficult to adjust them if they don't perfectly align with the patient's radiograph. Adding control points (Bézier handles) to the silhouettes to allow morphological warping (Free-Form Deformation) would elevate this feature to a professional grade.

## 5. Overall Architecture (`App.jsx`)

### 🟢 Strengths
- **Rich Keyboard Shortcuts:** The hotkey handling (Undo, Redo, Tools) makes it a power-user friendly app.
- **Extensive UI Components:** The custom components (`Btn`, `PropRow`, `Inp`) give the app a unified, sleek design language.

### 🔴 Areas for Improvement
- **Monolithic `App.jsx`:** Even after refactoring to ~1362 lines, `App.jsx` is doing too much. It handles:
  1. The Canvas rendering loop (`redraw()`).
  2. File dropping/importing.
  3. Extensive keyboard listeners.
  4. Undo/Redo stack.
  5. The entire layout wrapper.
  
  > [!NOTE]
  > The `redraw` loop, event handlers (`handleMouseDown`), and Undo/Redo logic should be extracted into a `useCanvasInteraction()` hook or a dedicated `<CephCanvas />` component.
- **Frequent Re-renders:** A state update in `App.jsx` (like `placingIdx` changing) re-renders the entire main component tree. Given the heavy `requestAnimationFrame` canvas logic, React's render cycle might occasionally fight with the canvas drawing cycle.

---

## Summary of Actionable Recommendations

1. **Move Heavy Compute to Workers:** Offload statistical analyses (especially `longitudinal.js` and `comparative.js`) to WebWorkers to prevent UI freezes.
2. **Optimize Image Storage:** Refactor the session image storage to use `Blob`/`ObjectURL` rather than holding 100MB+ base64 strings in the Redux/Zustand state tree.
3. **Componentize `App.jsx`:** Extract the Canvas and its specific event handlers out of the main App shell to improve maintainability.
4. **SVG Interactivity:** Add native HTML tooltips (`<title>`) to your SVG chart elements so researchers can identify outliers in plots like Bland-Altman or Error Maps.
5. **Add Math Tests:** If keeping custom statistical CDFs and approximations, write a unit testing suite (`Vitest` is already recommended in your AGENTS.md) exclusively for the math library to compare outputs against known R/SPSS datasets.
