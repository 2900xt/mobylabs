"use client";

import { useState, useRef } from "react";
import { Loader2, ArrowUp, Paperclip, X, FileText } from "lucide-react";

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  compact?: boolean;
  onFileSelect?: (file: File) => void;
  onFileClear?: () => void;
  selectedFile?: File | null;
  isParsingFile?: boolean;
  extractedText?: string;
}

export default function SearchBar({
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  isDisabled = false,
  placeholder = "Paste or upload an abstract to search...",
  compact = false,
  onFileSelect,
  onFileClear,
  selectedFile,
  isParsingFile = false,
  extractedText = "",
}: SearchBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSearch();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleClearFile = () => {
    if (onFileClear) {
      onFileClear();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isSubmitDisabled = isSearching || isParsingFile || isDisabled || (!searchQuery.trim() && !extractedText);

  return (
    <div className="w-full">
      {/* File indicator */}
      {selectedFile && (
        <div className={`flex items-center gap-2 mb-2 px-3 ${compact ? 'py-1.5' : 'py-2'} bg-cyan-500/10 border border-cyan-500/20 rounded-lg`}>
          <FileText className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-cyan-400`} />
          <span className={`${compact ? 'text-xs' : 'text-sm'} text-cyan-300 truncate flex-1`}>{selectedFile.name}</span>
          <button
            onClick={handleClearFile}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-white/60`} />
          </button>
        </div>
      )}

      <div className="relative">
        <textarea
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "Ask a question about this document (optional)..." : placeholder}
          rows={compact ? 1 : 3}
          disabled={isParsingFile || isDisabled}
          className={`w-full pl-4 ${compact ? 'pr-20 py-3' : 'pr-24 py-4'} bg-slate-800/50 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 resize-none transition-colors disabled:opacity-50`}
          style={{ minHeight: compact ? "48px" : "100px", maxHeight: compact ? "120px" : "200px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = compact ? "48px" : "100px";
            target.style.height = Math.min(target.scrollHeight, compact ? 120 : 200) + "px";
          }}
        />

        {/* Action buttons */}
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          {/* File upload button */}
          {onFileSelect && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingFile || isSearching || isDisabled}
                className="p-2 text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-50 rounded-lg transition-colors"
                title="Upload PDF or document"
              >
                {isParsingFile ? (
                  <Loader2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} />
                ) : (
                  <Paperclip className={`${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
                )}
              </button>
            </>
          )}

          {/* Search button */}
          <button
            onClick={onSearch}
            disabled={isSubmitDisabled}
            className="p-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {isSearching ? (
              <Loader2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} animate-spin text-white`} />
            ) : (
              <ArrowUp className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
            )}
          </button>
        </div>
      </div>

      {!compact && (
        <p className="text-white/30 text-xs mt-3 text-center">
          Supports PDF files up to 10MB
        </p>
      )}
    </div>
  );
}
