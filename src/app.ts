import express from "express";
import path from "path";
import mime from "mime-types"; // Import mime-types library
import {
  applyImageTransformations,
  applyVideoTransformations,
} from "./utils/transformations";
import { parseTransformationUrl } from "./utils/parser";
import { Writable } from "stream";
import fs from "fs/promises"; // For reading files

const app = express();
const PORT = 3000;

app.get("/:type/upload/*", async (req, res) => {
  try {
    const { type } = req.params;
    const url = req.originalUrl;

    const { publicId, transformations } = parseTransformationUrl(url);
    const inputPath = path.join("uploads", publicId);

    // Determine the MIME type based on the file extension
    const mimeType = mime.lookup(inputPath);
    if (!mimeType) {
      throw new Error("Unsupported file type.");
    }

    if (type === "image") {
      const imgBuffer = await applyImageTransformations(
        inputPath,
        transformations
      );

      res.set("Content-Type", mimeType); // Set Content-Type dynamically
      res.send(imgBuffer);
    } else if (type === "video") {
      res.set("Content-Type", mimeType); // Set Content-Type dynamically

      const writable = new Writable({
        write(chunk, encoding, callback) {
          res.write(chunk);
          callback();
        },
      });

      await applyVideoTransformations(writable, inputPath, transformations);
      writable.end(() => res.end());
    } else {
      throw new Error("Unsupported type.");
    }
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
