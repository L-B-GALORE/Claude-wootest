/**
 * File Upload Component for MMS Attachments
 *
 * Features:
 * - Drag and drop support
 * - Image thumbnail preview
 * - File type icons for non-images
 * - Upload progress indicator
 * - File size validation
 * - Multiple file upload
 */

import { useState, useRef } from 'react';
import { X, Upload, Image, File, FileVideo, FileAudio, Loader2 } from 'lucide-react';
import api from '../../services/api';

export default function FileUpload({ onFilesUploaded, maxFiles = 5, maxSize = 5 }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const maxSizeBytes = maxSize * 1024 * 1024; // Convert MB to bytes

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-6 h-6" />;
    } else if (file.type.startsWith('video/')) {
      return <FileVideo className="w-6 h-6" />;
    } else if (file.type.startsWith('audio/')) {
      return <FileAudio className="w-6 h-6" />;
    } else {
      return <File className="w-6 h-6" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);

    // Filter out invalid files
    const validFiles = fileArray.filter((file) => {
      if (file.size > maxSizeBytes) {
        alert(`${file.name} is too large. Maximum size is ${maxSize}MB.`);
        return false;
      }

      // Check file type
      const validTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime',
        'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav',
        'application/pdf', 'text/plain'
      ];

      if (!validTypes.includes(file.type)) {
        alert(`${file.name} has an unsupported file type.`);
        return false;
      }

      return true;
    });

    // Limit number of files
    if (files.length + validFiles.length > maxFiles) {
      alert(`You can only upload up to ${maxFiles} files at a time.`);
      return;
    }

    // Create file objects with preview URLs
    const newFiles = validFiles.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      uploading: false,
      uploaded: false,
      error: null,
      uploadData: null,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      // Revoke preview URL to avoid memory leaks
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);

    const uploadedFiles = [];

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i];

      // Skip already uploaded files
      if (fileObj.uploaded) {
        uploadedFiles.push(fileObj.uploadData);
        continue;
      }

      // Mark as uploading
      setFiles((prev) => {
        const newFiles = [...prev];
        newFiles[i].uploading = true;
        return newFiles;
      });

      try {
        const formData = new FormData();
        formData.append('file', fileObj.file);

        const response = await api.post('/api/v1/media/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        const uploadData = response.data.data;

        // Mark as uploaded
        setFiles((prev) => {
          const newFiles = [...prev];
          newFiles[i].uploading = false;
          newFiles[i].uploaded = true;
          newFiles[i].uploadData = uploadData;
          return newFiles;
        });

        uploadedFiles.push(uploadData);
      } catch (error) {
        console.error('Upload error:', error);

        // Mark as error
        setFiles((prev) => {
          const newFiles = [...prev];
          newFiles[i].uploading = false;
          newFiles[i].error = 'Upload failed';
          return newFiles;
        });
      }
    }

    setUploading(false);

    // Call callback with uploaded file data
    if (uploadedFiles.length > 0) {
      onFilesUploaded(uploadedFiles);
    }
  };

  return (
    <div className="space-y-3">
      {/* File Upload Area */}
      {files.length < maxFiles && (
        <div
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-600'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag and drop files here, or click to select
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Images, videos, audio, or PDFs (max {maxSize}MB each)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.txt"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
        </div>
      )}

      {/* File Preview List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileObj, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              {/* Preview/Icon */}
              <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {fileObj.preview ? (
                  <img
                    src={fileObj.preview}
                    alt={fileObj.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    {getFileIcon(fileObj.file)}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {fileObj.file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(fileObj.file.size)}
                </p>
              </div>

              {/* Status */}
              <div className="flex-shrink-0">
                {fileObj.uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                ) : fileObj.uploaded ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : fileObj.error ? (
                  <div className="text-xs text-red-500">{fileObj.error}</div>
                ) : (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Upload Button */}
          {files.some((f) => !f.uploaded) && (
            <button
              onClick={uploadFiles}
              disabled={uploading}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload {files.filter((f) => !f.uploaded).length} file(s)
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
