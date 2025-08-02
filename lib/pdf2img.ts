export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  isLoading = true;
  // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
  loadPromise = import("pdfjs-dist/build/pdf.mjs").then((lib) => {
    // Set the worker source to use local file
    lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    pdfjsLib = lib;
    isLoading = false;
    return lib;
  });

  return loadPromise;
}

export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  try {
    console.log("🔄 Loading PDF.js...");
    const lib = await loadPdfJs();
    console.log("✅ PDF.js loaded");

    console.log("📦 Reading file into arrayBuffer...");
    const arrayBuffer = await file.arrayBuffer();
    console.log("✅ File read complete");

    console.log("📄 Loading PDF document...");
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    console.log(`✅ PDF document loaded (${pdf.numPages} pages)`);

    console.log("📄 Getting page 1...");
    const page = await pdf.getPage(1);
    console.log("✅ Page 1 retrieved");

    const scale = 4;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (!context) {
      console.error("❌ Canvas context could not be retrieved");
      return {
        imageUrl: "",
        file: null,
        error: "Canvas context could not be retrieved",
      };
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    console.log("🎨 Rendering PDF page to canvas...");
    await page.render({ canvasContext: context, viewport }).promise;
    console.log("✅ Rendering complete");

    return new Promise((resolve) => {
      console.log("🧪 Converting canvas to blob...");
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log("✅ Blob created successfully");
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            console.error("❌ toBlob returned null");
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob",
            });
          }
        },
        "image/png",
        1.0
      );
    });
  } catch (err) {
    console.error("❌ Exception during PDF conversion:", err);
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err}`,
    };
  }
}

