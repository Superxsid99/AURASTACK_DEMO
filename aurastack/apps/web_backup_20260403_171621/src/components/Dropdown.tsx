import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface DropdownProps {
  label: string;
  options: { label: string; value: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Dropdown({ label, options, value, onChange, className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[#64748B] tracking-wide">{label}</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "inline-flex items-center justify-between w-full h-9 rounded-lg border bg-white border-[#E2E8F0] px-3 py-2 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#1F9D8B]/20 focus:border-[#1F9D8B] transition-all duration-150",
            isOpen && "bg-[#E6F6F3] text-[#1F9D8B] border-[#A7E3D8]"
          )}
        >
          <span className="flex items-center gap-2">
            {selectedOption.label}
            {selectedOption.count !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#64748B]">
                {selectedOption.count}
              </span>
            )}
          </span>
          <ChevronDown className={cn("ml-2 h-4 w-4 text-[#64748B] transition-transform duration-150", isOpen && "rotate-180 text-[#1F9D8B]")} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-lg bg-white border border-[#E2E8F0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus:outline-none overflow-hidden">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium transition-colors duration-150",
                  value === option.value 
                    ? "bg-[#E6F6F3] text-[#1F9D8B]" 
                    : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                )}
              >
                <span>{option.label}</span>
                {option.count !== undefined && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    value === option.value ? "bg-[#A7E3D8] text-[#0F766E]" : "bg-[#F1F5F9] text-[#64748B]"
                  )}>
                    {option.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
