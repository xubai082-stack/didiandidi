const bookElement = document.querySelector("#book");
const pages = bookElement.querySelectorAll(".book-page");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const pageStatus = document.querySelector("#page-status");
const orientationStatus = document.querySelector("#orientation");
const pageWidth = Number(bookElement.dataset.pageWidth) || 512;
const pageHeight = Number(bookElement.dataset.pageHeight) || 640;
document.documentElement.style.setProperty("--page-ratio", pageWidth / pageHeight);

const pageFlip = new St.PageFlip(bookElement, {
  width: pageWidth,
  height: pageHeight,
  size: "stretch",
  minWidth: 1,
  maxWidth: Math.max(1, Math.round(pageWidth * 1.04)),
  minHeight: 1,
  maxHeight: Math.max(1, Math.round(pageHeight * 1.04)),
  drawShadow: true,
  flippingTime: 760,
  usePortrait: false,
  startZIndex: 10,
  autoSize: true,
  maxShadowOpacity: 0.42,
  showCover: true,
  mobileScrollSupport: false,
  clickEventForward: true,
  useMouseEvents: false,
  swipeDistance: 24,
  showPageCorners: false,
  disableFlipByClick: false,
});

let currentPage = 0;
let isTurning = false;

function updateControls() {
  const pageCount = pageFlip.getPageCount();
  const lastPage = pageCount - 1;
  bookElement.dataset.edge = currentPage === 0 ? "front" : currentPage === lastPage ? "back" : "inside";

  previousButton.disabled = currentPage === 0 || isTurning;
  nextButton.disabled = currentPage >= pageCount - 2 || isTurning;

  if (currentPage === 0) {
    pageStatus.textContent = "封面";
  } else if (currentPage === lastPage) {
    pageStatus.textContent = "封底";
  } else {
    pageStatus.textContent = `${currentPage + 1}–${Math.min(currentPage + 2, pageCount)} / ${pageCount}`;
  }
}

pageFlip.on("flip", (event) => {
  currentPage = Number(event.data);
  updateControls();
});

pageFlip.on("changeState", (event) => {
  isTurning = event.data !== "read";
  updateControls();
});

function updateOrientation(orientation) {
  bookElement.dataset.layout = orientation;
  orientationStatus.textContent = orientation === "portrait" ? "Single page" : "Open spread";
}

pageFlip.on("init", (event) => updateOrientation(event.data.mode));
pageFlip.on("changeOrientation", (event) => updateOrientation(event.data));

pageFlip.loadFromHTML(pages);
updateControls();

// Keep the bundled renderer; Pointer Events unify touch and mouse dragging.
const surface = pageFlip.getUI().getDistElement();
const controller = pageFlip.getFlipController();
let gesture = null;

function finishDrag(commit) {
  const calculation = controller.getCalculation();
  if (!calculation) return;
  const bounds = pageFlip.getBoundsRect();
  controller.setState("flipping");
  controller.animateFlippingTo(calculation.getPosition(), {
    x: commit ? -bounds.pageWidth : bounds.pageWidth,
    y: calculation.getCorner() === "bottom" ? bounds.height : 0,
  }, commit);
}

surface.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0 || isTurning) return;
  const rect = surface.getBoundingClientRect();
  const bounds = pageFlip.getBoundsRect();
  const x = event.clientX - rect.left;
  const next = x >= bounds.left + bounds.width / 2;
  if ((next && nextButton.disabled) || (!next && previousButton.disabled)) return;
  const origin = { x, y: event.clientY - rect.top };
  gesture = { id: event.pointerId, origin, next, distance: 0, dragging: false };
  surface.setPointerCapture(event.pointerId);
  event.preventDefault();
});

surface.addEventListener("pointermove", (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const rect = surface.getBoundingClientRect();
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  gesture.distance = (point.x - gesture.origin.x) * (gesture.next ? -1 : 1);
  if (!gesture.dragging && gesture.distance > 6) {
    controller.fold(gesture.origin);
    gesture.dragging = true;
  }
  if (gesture.dragging) controller.fold(point);
});

function releaseGesture(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const current = gesture;
  gesture = null;
  const cancelled = event.type !== "pointerup";
  if (current.dragging) {
    finishDrag(!cancelled && current.distance >= pageFlip.getBoundsRect().pageWidth / 2);
  } else if (!cancelled && Math.abs(current.distance) <= 6) {
    if (current.next) pageFlip.flipNext("bottom");
    else pageFlip.flipPrev("bottom");
  }
}
surface.addEventListener("pointerup", releaseGesture);
surface.addEventListener("pointercancel", releaseGesture);
surface.addEventListener("lostpointercapture", releaseGesture);

const requestedPage = Number(new URLSearchParams(location.search).get("page"));
if (Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage < pages.length) {
  pageFlip.turnToPage(requestedPage);
}

previousButton.addEventListener("click", () => {
  if (!isTurning) pageFlip.flipPrev("bottom");
});

nextButton.addEventListener("click", () => {
  if (!isTurning) pageFlip.flipNext("bottom");
});

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || isTurning) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    pageFlip.flipPrev("bottom");
  }

  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    pageFlip.flipNext("bottom");
  }

  if (event.key === "Home") pageFlip.turnToPage(0);
  if (event.key === "End") pageFlip.turnToPage(pageFlip.getPageCount() - 1);
});
