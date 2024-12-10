import * as cv from "opencv.js";

/**
 * Plugin for removing the background using edge detection.
 * @param inputBuffer - The input image as a buffer.
 * @param params - Parameters for edge detection (lowerThreshold and upperThreshold).
 * @returns A promise resolving to the transformed image buffer.
 */
export async function removeBackgroundByEdgesPlugin(
  inputBuffer: Uint8Array,
  params: { lowerThreshold?: number; upperThreshold?: number } = {}
): Promise<Buffer> {
  const lowerThreshold = params.lowerThreshold ?? 50;
  const upperThreshold = params.upperThreshold ?? 150;

  // Convert input buffer to ImageData
  const img = new Image();
  const imgPromise = new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.src = URL.createObjectURL(new Blob([inputBuffer]));
  });
  await imgPromise;

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get 2D context");

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  // Create Mat from ImageData
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const mask = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);

  // Convert to grayscale
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Detect edges
  cv.Canny(gray, edges, lowerThreshold, upperThreshold);

  // Find contours and fill the mask
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE
  );

  for (let i = 0; i < contours.size(); i++) {
    cv.drawContours(mask, contours, i, new cv.Scalar(255, 255, 255), -1);
  }

  // Apply the mask
  const result = new cv.Mat();
  src.copyTo(result, mask);

  // Convert the result back to ImageData and draw it on a canvas
  const outputImageData = new ImageData(
    new Uint8ClampedArray(result.data),
    src.cols,
    src.rows
  );
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = src.cols;
  outputCanvas.height = src.rows;

  const outputCtx = outputCanvas.getContext("2d");
  if (outputCtx) {
    outputCtx.putImageData(outputImageData, 0, 0);
  } else {
    throw new Error("Failed to get 2D context");
  }

  // Convert the canvas to a Buffer
  const bufferPromise = new Promise<Buffer>((resolve) => {
    outputCanvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blob!);
    });
  });

  // Clean up
  src.delete();
  gray.delete();
  edges.delete();
  mask.delete();
  contours.delete();
  hierarchy.delete();
  result.delete();

  return bufferPromise;
}
