import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const expectedAssets = [
  { path: "public/images/hero-trainer.avif", width: 1200, height: 1400 },
  { path: "public/images/hero-trainer.webp", width: 1200, height: 1400 },
  { path: "public/brand/favicon-32.png", width: 32, height: 32 },
  { path: "public/brand/apple-touch-icon.png", width: 180, height: 180 },
];

const reviewedFiles = new Set(expectedAssets.map((asset) => asset.path));
const reviewedDirectories = ["public/images", "public/brand"];

async function verifyExpectedAsset(asset) {
  const absolutePath = path.join(root, asset.path);
  await access(absolutePath);

  const file = await stat(absolutePath);
  if (file.size === 0) {
    throw new Error(`${asset.path} must not be empty`);
  }

  const metadata = await sharp(absolutePath).metadata();
  if (metadata.width !== asset.width || metadata.height !== asset.height) {
    throw new Error(
      `${asset.path} must be ${asset.width}x${asset.height}, received ${metadata.width}x${metadata.height}`,
    );
  }
}

async function verifyNoUnreviewedAssets() {
  for (const directory of reviewedDirectories) {
    const absoluteDirectory = path.join(root, directory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        throw new Error(`${directory}/${entry.name} is not a reviewed file`);
      }

      const assetPath = path.posix.join(directory, entry.name);
      if (!reviewedFiles.has(assetPath)) {
        throw new Error(`${assetPath} is not in the reviewed asset inventory`);
      }
    }
  }
}

for (const asset of expectedAssets) {
  await verifyExpectedAsset(asset);
}

await verifyNoUnreviewedAssets();
console.log(`Verified ${expectedAssets.length} reviewed visual assets.`);
