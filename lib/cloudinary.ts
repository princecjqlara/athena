// Cloudinary configuration
export const cloudinaryConfig = {
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    uploadPreset: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ads_algorithm',
    folder: 'ads-algorithm-videos',
};

// Generate Cloudinary upload URL
export const getCloudinaryUploadUrl = () => {
    return `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/video/upload`;
};

// Upload video to Cloudinary
export const uploadVideoToCloudinary = async (file: File): Promise<{
    url: string;
    public_id: string;
    thumbnail_url: string;
    duration: number;
}> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', cloudinaryConfig.folder);
    formData.append('resource_type', 'video');

    const response = await fetch(getCloudinaryUploadUrl(), {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Failed to upload video to Cloudinary');
    }

    const data = await response.json();

    return {
        url: data.secure_url,
        public_id: data.public_id,
        thumbnail_url: data.secure_url.replace(/\.[^.]+$/, '.jpg'),
        duration: Math.round(data.duration || 0),
    };
};

// Generate optimized thumbnail URL
export const getThumbnailUrl = (publicId: string, options?: {
    width?: number;
    height?: number;
    crop?: string;
}) => {
    const { width = 400, height = 300, crop = 'fill' } = options || {};
    return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/video/upload/w_${width},h_${height},c_${crop},so_0/${publicId}.jpg`;
};

// Generate video preview URL (first 5 seconds as GIF)
export const getPreviewUrl = (publicId: string) => {
    return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/video/upload/w_400,h_300,c_fill,so_0,eo_5,f_gif/${publicId}.gif`;
};
