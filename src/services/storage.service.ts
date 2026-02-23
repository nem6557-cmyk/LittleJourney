import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const BUCKETS = {
  avatars: 'avatars',
  timelinePhotos: 'timeline-photos',
  documents: 'documents',
  daycareAssets: 'daycare-assets',
} as const;

export const storageService = {
  /**
   * Upload an image from the device. Returns the public/signed URL.
   */
  uploadImage: async (
    bucket: keyof typeof BUCKETS,
    path: string,
    uri: string,
    contentType: string = 'image/jpeg'
  ): Promise<string> => {
    const bucketName = BUCKETS[bucket];

    // Convert URI to blob for upload
    const response = await fetch(uri);
    const blob = await response.blob();

    // Convert blob to ArrayBuffer
    const arrayBuffer = await new Response(blob).arrayBuffer();

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    // Get URL
    if (bucket === 'avatars' || bucket === 'daycareAssets') {
      // Public buckets
      const { data } = supabase.storage.from(bucketName).getPublicUrl(path);
      return data.publicUrl;
    } else {
      // Private buckets — signed URL (1 hour)
      const { data, error: urlError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, 3600);
      if (urlError) throw urlError;
      return data.signedUrl;
    }
  },

  /**
   * Upload avatar for current user
   */
  uploadAvatar: async (userId: string, uri: string) => {
    const ext = uri.split('.').pop() || 'jpg';
    const path = `${userId}/avatar.${ext}`;
    return storageService.uploadImage('avatars', path, uri);
  },

  /**
   * Upload timeline photo
   */
  uploadTimelinePhoto: async (daycareId: string, childId: string, uri: string) => {
    const ext = uri.split('.').pop() || 'jpg';
    const filename = `${Date.now()}.${ext}`;
    const path = `${daycareId}/${childId}/${filename}`;
    return storageService.uploadImage('timelinePhotos', path, uri);
  },

  /**
   * Get signed URL for a private file
   */
  getSignedUrl: async (bucket: keyof typeof BUCKETS, path: string, expiresIn: number = 3600) => {
    const { data, error } = await supabase.storage
      .from(BUCKETS[bucket])
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Delete a file
   */
  deleteFile: async (bucket: keyof typeof BUCKETS, path: string) => {
    const { error } = await supabase.storage
      .from(BUCKETS[bucket])
      .remove([path]);
    if (error) throw error;
  },

  /**
   * List files in a folder
   */
  listFiles: async (bucket: keyof typeof BUCKETS, folder: string) => {
    const { data, error } = await supabase.storage
      .from(BUCKETS[bucket])
      .list(folder, { sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    return data;
  },

  /**
   * Pick and upload image from device
   */
  pickAndUploadImage: async (
    bucket: keyof typeof BUCKETS,
    path: string,
    options?: { allowsEditing?: boolean; aspect?: [number, number]; quality?: number }
  ) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: options?.allowsEditing ?? true,
      aspect: options?.aspect ?? [1, 1],
      quality: options?.quality ?? 0.8,
    });

    if (result.canceled || !result.assets[0]) return null;

    const uri = result.assets[0].uri;
    const url = await storageService.uploadImage(bucket, path, uri);
    return url;
  },
};
