/**
 * Media Attachment Component
 *
 * Displays media attachments (images, videos, audio, documents) in messages
 *
 * Features:
 * - Image thumbnails with lightbox
 * - Video player
 * - Audio player
 * - Document download
 */

import { useState } from 'react';
import { X, Download, File, FileVideo, FileAudio, Image as ImageIcon, ExternalLink } from 'lucide-react';
import api from '../../services/api';

export default function MediaAttachment({ media, isInbound }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Generate media URL from storage key
  const getMediaUrl = (url) => {
    // URL is in format: media/{companyId}/{messageId}/{filename}
    return `${api.defaults.baseURL}/api/v1/media/${url}`;
  };

  const handleImageClick = (mediaItem) => {
    if (mediaItem.type === 'image') {
      setLightboxImage(mediaItem);
      setLightboxOpen(true);
    }
  };

  const handleDownload = async (mediaItem) => {
    try {
      const url = getMediaUrl(mediaItem.url);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = mediaItem.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  if (!media || media.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        {media.map((mediaItem, index) => (
          <div key={index}>
            {/* Image */}
            {mediaItem.type === 'image' && (
              <div
                className="relative group cursor-pointer rounded-lg overflow-hidden max-w-sm"
                onClick={() => handleImageClick(mediaItem)}
              >
                <img
                  src={getMediaUrl(mediaItem.url)}
                  alt={mediaItem.filename}
                  className="w-full h-auto max-h-64 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}

            {/* Video */}
            {mediaItem.type === 'video' && (
              <div className="max-w-sm rounded-lg overflow-hidden">
                <video
                  controls
                  className="w-full h-auto max-h-64 rounded-lg"
                  src={getMediaUrl(mediaItem.url)}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* Audio */}
            {mediaItem.type === 'audio' && (
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 max-w-sm">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileAudio className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <audio controls className="w-full">
                    <source src={getMediaUrl(mediaItem.url)} type={mediaItem.metadata?.contentType || 'audio/mpeg'} />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            )}

            {/* Document */}
            {mediaItem.type === 'document' && (
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 max-w-sm">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <File className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {mediaItem.filename}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {mediaItem.sizeBytes
                      ? `${(mediaItem.sizeBytes / 1024).toFixed(1)} KB`
                      : 'Unknown size'
                    }
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(mediaItem)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Lightbox */}
      {lightboxOpen && lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="relative max-w-4xl max-h-full">
            <img
              src={getMediaUrl(lightboxImage.url)}
              alt={lightboxImage.filename}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
              <p className="text-sm">{lightboxImage.filename}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
