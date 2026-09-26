import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X, Check, Link, Sparkles } from 'lucide-react';

interface PresetOption {
  label: string;
  url: string;
}

interface ImageUploaderProps {
  value?: string;
  onChange: (imageUrl: string) => void;
  label?: string;
  helperText?: string;
  aspectRatio?: 'square' | 'video' | 'banner' | 'avatar';
  presets?: PresetOption[];
  allowUrlInput?: boolean;
  maxDimension?: number;
  className?: string;
  id?: string;
}

// Compress and resize image to lightweight Data URL (< 150KB) so localStorage doesn't overflow
const compressImageFile = (file: File, maxDim: number = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Convert to web-friendly JPEG with 0.82 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  label,
  helperText,
  aspectRatio = 'square',
  presets = [],
  allowUrlInput = true,
  maxDimension = 800,
  className = '',
  id
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP, GIF)');
      return;
    }
    setIsProcessing(true);
    try {
      const dataUrl = await compressImageFile(file, maxDimension);
      onChange(dataUrl);
    } catch (err) {
      console.error('Image compression failed:', err);
      // Fallback direct read
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onChange(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlDraft.trim()) {
      onChange(urlDraft.trim());
      setShowUrlInput(false);
      setUrlDraft('');
    }
  };

  const getAspectClasses = () => {
    switch (aspectRatio) {
      case 'avatar':
        return 'w-24 h-24 sm:w-28 sm:h-28 rounded-2xl';
      case 'banner':
        return 'w-full h-36 sm:h-44 rounded-2xl';
      case 'video':
        return 'w-full aspect-video rounded-2xl';
      case 'square':
      default:
        return 'w-32 h-32 sm:w-36 sm:h-36 rounded-2xl';
    }
  };

  return (
    <div className={`space-y-2.5 ${className}`} id={id}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300">
            {label}
          </label>
          {allowUrlInput && (
            <button
              type="button"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Link className="w-3 h-3" />
              <span>{showUrlInput ? 'ซ่อนใส่ลิงก์ URL' : 'หรือระบุ URL รูป'}</span>
            </button>
          )}
        </div>
      )}

      {/* Manual URL input fallback if requested */}
      {showUrlInput && (
        <form onSubmit={handleUrlSubmit} className="flex gap-2 mb-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="วางลิงก์รูปภาพ https://..."
            className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-stone-900 dark:text-white"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
          >
            ใช้รูปนี้
          </button>
        </form>
      )}

      {/* Main Upload / Preview Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Preview or Drop Box */}
        {value ? (
          <div className="relative group shrink-0">
            <div
              className={`overflow-hidden border-2 border-orange-400/80 dark:border-orange-500/60 bg-stone-100 dark:bg-zinc-800 shadow-md ${getAspectClasses()}`}
            >
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Quick Action Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-xl bg-white/90 hover:bg-white text-stone-900 text-xs font-bold shadow cursor-pointer transition-transform active:scale-95"
                title="เปลี่ยนรูปภาพ"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-bold shadow cursor-pointer transition-transform active:scale-95"
                title="ลบรูปภาพ"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${getAspectClasses()} ${
              isDragging
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                : 'border-stone-300 dark:border-zinc-700 bg-stone-50/70 dark:bg-zinc-900/60 hover:bg-orange-50/50 dark:hover:bg-zinc-800/80 hover:border-orange-400'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-1.5 text-orange-600">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[11px] font-bold">กำลังประมวลผล...</span>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-1.5 shadow-xs">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-stone-700 dark:text-zinc-200">
                  อัปโหลดรูป
                </span>
                <span className="text-[10px] text-stone-500 dark:text-zinc-400">
                  ลากวาง หรือคลิกเพื่อเลือกไฟล์
                </span>
              </>
            )}
          </div>
        )}

        {/* Upload Button, Instructions, and File input */}
        <div className="space-y-2 flex-1 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{value ? 'เปลี่ยนรูปภาพจากอุปกรณ์' : 'เลือกรูปจากเครื่อง / มือถือ'}</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-600 hover:text-red-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-red-950/30 text-xs font-medium transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>ลบรูป</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-stone-500 dark:text-zinc-400 leading-relaxed">
            {helperText || 'รองรับไฟล์ JPG, PNG, WebP ขนาดสูงสุด 10MB (ระบบบีบอัดให้อัตโนมัติเพื่อความเร็ว)'}
          </p>
        </div>
      </div>

      {/* Preset Gallery if available */}
      {presets.length > 0 && (
        <div className="pt-2 border-t border-stone-100 dark:border-zinc-800/80 space-y-1.5">
          <span className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-orange-500" />
            <span>หรือเลือกจากรูปภาพตัวอย่างสำเร็จรูป:</span>
          </span>
          <div className="flex flex-wrap gap-2 items-center">
            {presets.map((preset, idx) => {
              const isSelected = value === preset.url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange(preset.url)}
                  className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-300 ring-2 ring-orange-400/40'
                      : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.label}
                    className="w-6 h-6 rounded-lg object-cover"
                  />
                  <span>{preset.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-orange-600 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
