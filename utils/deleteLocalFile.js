import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

const deleteLocalFile = (publicId) => {
  if (!publicId) return;

  const filePath = path.join(UPLOADS_ROOT, publicId);

  fs.unlink(filePath, (err) => {
    // Ignore "file doesn't exist" errors, log anything else
    if (err && err.code !== "ENOENT") {
      console.error("Failed to delete local file:", err.message);
    }
  });
};

export default deleteLocalFile;