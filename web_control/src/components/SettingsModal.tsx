import React from "react";
import { X } from "lucide-react";
import Settings, { NexusEngineConfig } from "./Settings";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: Partial<NexusEngineConfig>;
  onSave?: (config: NexusEngineConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <Settings
          initialConfig={config}
          onSave={(updated) => {
            onSave?.(updated);
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default SettingsModal;
