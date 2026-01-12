"use client";

import Image from "next/image";
import SearchBar from "./SearchBar";

interface PreSearchViewProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  onFileSelect: (file: File) => void;
  onFileClear: () => void;
  selectedFile: File | null;
  isParsingFile: boolean;
  extractedText: string;
  error: string | null;
}

export default function PreSearchView({
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  onFileSelect,
  onFileClear,
  selectedFile,
  isParsingFile,
  extractedText,
  error,
}: PreSearchViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="text-center mb-4">
        {/* Logo and Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Image src="/logo.png" alt="Moby Labs Logo" width={40} height={40} />
          <span className="text-3xl font-bold bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
            Moby Labs
          </span>
          <span className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-600 bg-clip-text text-transparent">
            Reef
          </span>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">What paper are you looking for?</h1>
      </div>

      {/* Centered search input */}
      <div className="w-full max-w-2xl">
        {error && (
          <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={onSearch}
          isSearching={isSearching}
          onFileSelect={onFileSelect}
          onFileClear={onFileClear}
          selectedFile={selectedFile}
          isParsingFile={isParsingFile}
          extractedText={extractedText}
        />
      </div>
    </div>
  );
}
