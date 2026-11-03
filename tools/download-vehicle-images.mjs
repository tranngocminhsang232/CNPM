import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { S3Client, PutObjectCommand } = require('../apps/api/node_modules/@aws-sdk/client-s3');

// High-resolution automotive photos from Unsplash (free license)
const VEHICLE_IMAGE_MAP = {
  // VinFast VF8 Plus (SUV điện cao cấp)
  '10000000-0000-0000-0000-000000000001': [
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=85', // Exterior front
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=85', // Exterior angle
    'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=85', // Tech cockpit
  ],
  // Hyundai Santa Fe Cao Cấp (SUV 7 chỗ)
  '10000000-0000-0000-0000-000000000002': [
    'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=85',
  ],
  // Toyota Camry 2.5Q (Sedan lịch lãm)
  '10000000-0000-0000-0000-000000000003': [
    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=85',
  ],
  // Mazda CX-5 2.0 Premium (Crossover đỏ)
  '10000000-0000-0000-0000-000000000004': [
    'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=85',
  ],
  // VinFast VF3 (Mini SUV điện)
  '10000000-0000-0000-0000-000000000005': [
    'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=85',
  ],
  // Kia Carnival Signature (MPV 7 chỗ)
  '10000000-0000-0000-0000-000000000006': [
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=85',
  ],
  // Mitsubishi Xpander Cross (MPV)
  '10000000-0000-0000-0000-000000000007': [
    'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=85',
  ],
  // VinFast VF9 Plus (Full-size SUV 6 chỗ)
  '10000000-0000-0000-0000-000000000008': [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=85',
  ],
  // Toyota Corolla Cross 1.8V (Crossover)
  '10000000-0000-0000-0000-000000000009': [
    'https://images.unsplash.com/photo-1619682817481-e994891cd1f5?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=85',
  ],
  // Honda CR-V L (Crossover 7 chỗ)
  '10000000-0000-0000-0000-000000000010': [
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=1200&q=85',
  ],
  // Ford Everest Titanium+ (SUV 4WD)
  '10000000-0000-0000-0000-000000000011': [
    'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=85',
  ],
  // VinFast VF6 Plus (Crossover điện)
  '10000000-0000-0000-0000-000000000012': [
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=85',
    'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=85',
  ],
  // Toyota Yaris Cross (DRAFT vehicle)
  '10000000-0000-0000-0000-000000000013': [
    'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=85',
  ],
};

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true,
});
const bucket = process.env.S3_BUCKET_PRIVATE || 'car-sharing-private';

async function main() {
  console.log('--- Starting Vehicle Image Downloader & Syncer ---');

  const webPublicDir = path.resolve('apps/web/public/images/vehicles');
  const apiAssetsDir = path.resolve('apps/api/assets/vehicles');

  fs.mkdirSync(webPublicDir, { recursive: true });
  fs.mkdirSync(apiAssetsDir, { recursive: true });

  for (const [vehicleId, urls] of Object.entries(VEHICLE_IMAGE_MAP)) {
    const webVehDir = path.join(webPublicDir, vehicleId);
    const apiVehDir = path.join(apiAssetsDir, vehicleId);
    fs.mkdirSync(webVehDir, { recursive: true });
    fs.mkdirSync(apiVehDir, { recursive: true });

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const filename = i === 0 ? 'cover.jpg' : `photo-${i + 1}.jpg`;
      const webFilePath = path.join(webVehDir, filename);
      const apiFilePath = path.join(apiVehDir, filename);

      try {
        console.log(`Downloading ${vehicleId} -> ${filename}...`);
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`Failed to download ${url}: status ${res.status}`);
          continue;
        }

        const buffer = Buffer.from(await res.arrayBuffer());

        // Write to web public directory
        fs.writeFileSync(webFilePath, buffer);
        // Write to api assets directory
        fs.writeFileSync(apiFilePath, buffer);

        // Upload to MinIO S3
        const s3Key = `vehicles/${vehicleId}/${filename}`;
        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: 'image/jpeg',
          }),
        );
        console.log(`✓ Uploaded to MinIO: ${s3Key} (${buffer.length} bytes)`);
      } catch (err) {
        console.error(`Error processing ${vehicleId}/${filename}:`, err.message);
      }
    }
  }

  // Create default-car.jpg fallback
  const firstCarCover = path.join(webPublicDir, '10000000-0000-0000-0000-000000000001', 'cover.jpg');
  if (fs.existsSync(firstCarCover)) {
    fs.copyFileSync(firstCarCover, path.join(webPublicDir, 'default-car.jpg'));
    fs.copyFileSync(firstCarCover, path.join(apiAssetsDir, 'default-car.jpg'));
  }

  console.log('--- Finished Vehicle Image Downloader & Syncer ---');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
