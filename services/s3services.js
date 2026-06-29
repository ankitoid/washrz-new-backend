    import AWS from "aws-sdk";
    import multer from 'multer';

    // Reuse the same credentials as in your authController
    const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    region: process.env.AWS_S3_REGION,
    });

    /**
     * Upload a file to S3 and return the public URL.
     * @param {Buffer} fileBuffer - the file data
     * @param {string} originalName - original file name (for extension)
     * @param {string} mimeType - e.g., 'image/jpeg'
     * @param {string} folder - folder path inside the bucket, e.g., 'customer-chat-images'
     * @returns {Promise<{ Location: string, Key: string }>}
     */
    export const uploadFileToS3 = (fileBuffer, originalName, mimeType, folder, bucketName) => {
    const timestamp = Date.now();
    // Sanitize the original name: replace spaces and special chars
    const safeName = originalName.replace(/\s+/g, '_');
    const key = `${folder}/${timestamp}_${safeName}`;

    const params = {
        Bucket: bucketName, // e.g., 'shiptos-general'
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        // Optional: set ACL to 'public-read' if you want public URLs.
        // If your bucket policy already allows public reads, you can omit this.
        // ACL: 'public-read',
    };

    return s3.upload(params).promise();
    };




    //upload middleware

    const storage = multer.memoryStorage();

    const fileFilter = (req, file, cb) => {
    console.log("inside this calledd")
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
    };

    export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    });
