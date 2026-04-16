import AWS from "aws-sdk";
import CatalogItem from "../models/catalogItemSchema.js";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION,
});

const sanitizeName = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const uploadCatalogFileToS3 = async (
  file,
  folder = "catalog-photos/default"
) => {
  const safeName = sanitizeName(file.originalname || "file");
  const key = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${safeName}`;

  const uploadResult = await s3
    .upload({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
    .promise();

  return {
    url: uploadResult.Location,
    key: uploadResult.Key,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    kind: file.mimetype?.startsWith("video/") ? "video" : "image",
  };
};

const listAllObjects = async (prefix) => {
  const objects = [];
  let continuationToken;

  do {
    const response = await s3
      .listObjectsV2({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
      .promise();

    objects.push(...(response.Contents || []));
    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
};

const deleteObjects = async (keys = []) => {
  if (keys.length === 0) {
    return { deletedCount: 0 };
  }

  const chunks = [];
  for (let index = 0; index < keys.length; index += 1000) {
    chunks.push(keys.slice(index, index + 1000));
  }

  let deletedCount = 0;

  for (const chunk of chunks) {
    const response = await s3
      .deleteObjects({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
      .promise();

    deletedCount += response.Deleted?.length || 0;
  }

  return { deletedCount };
};

export const cleanupUnusedCatalogMedia = async ({
  prefix = "catalog-photos/",
  olderThanHours = 24,
  dryRun = false,
} = {}) => {
  const items = await CatalogItem.find({}, { images: 1, videos: 1 }).lean();

  const usedKeys = new Set();
  for (const item of items) {
    for (const image of item.images || []) {
      if (image.key) usedKeys.add(image.key);
    }
    for (const video of item.videos || []) {
      if (video.key) usedKeys.add(video.key);
    }
  }

  const files = await listAllObjects(prefix);
  const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;

  const orphanFiles = files.filter((file) => {
    if (!file.Key) return false;
    if (usedKeys.has(file.Key)) return false;
    if (!file.LastModified) return false;
    return new Date(file.LastModified).getTime() < cutoffTime;
  });

  if (dryRun) {
    return {
      checkedCount: files.length,
      orphanCount: orphanFiles.length,
      deletedCount: 0,
      orphanKeys: orphanFiles.map((file) => file.Key),
    };
  }

  const deletionResult = await deleteObjects(
    orphanFiles.map((file) => file.Key).filter(Boolean)
  );

  return {
    checkedCount: files.length,
    orphanCount: orphanFiles.length,
    deletedCount: deletionResult.deletedCount,
    orphanKeys: orphanFiles.map((file) => file.Key),
  };
};
