import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All uploaded files land in Backend/uploads/<folder>/
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    try {
      const targetDir = path.join(UPLOADS_ROOT, folder);

      // Create the folder if it doesn't exist yet
      fs.mkdirSync(targetDir, { recursive: true });

      const filename = `${nanoid()}.jpg`;
      const filePath = path.join(targetDir, filename);

      fs.writeFileSync(filePath, buffer);

      const publicId = `${folder}/${filename}`;
      const baseUrl = process.env.BACKEND_URL || "http://localhost:5000";

      resolve({
        url: `${baseUrl}/uploads/${publicId}`,
        public_id: publicId,
      });
    } catch (error) {
      reject(error);
    }
  });
};

export default uploadToCloudinary;