import { memo, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { Message } from "../../stores/session";
import { commands } from "../../lib/tauri";

interface Props {
  message: Message;
}

export const UserMessage = memo(function UserMessage({ message }: Props) {
  const [hovering, setHovering] = useState(false);

  const handleRevert = async () => {
    if (!message.checkpoint_ref) return;
    if (!confirm("Revert to this checkpoint? Messages after this will be deleted.")) return;
    try {
      await commands.revertToCheckpoint(message.id);
    } catch (e) {
      console.error("Revert failed:", e);
    }
  };

  return (
    <div
      className="relative rounded-md px-4 py-3"
      style={{
        background: "var(--user-msg-bg)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p
            className="text-2xs font-medium mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            You
          </p>
          <p className="whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
            {message.content}
          </p>
        </div>

        {message.checkpoint_ref && hovering && (
          <button
            onClick={handleRevert}
            className="p-1 rounded hover:bg-white/10 flex-shrink-0"
            title="Revert to this checkpoint"
          >
            <RotateCcw size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
        )}
      </div>
    </div>
  );
});
