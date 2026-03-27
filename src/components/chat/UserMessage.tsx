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
      className="relative rounded-lg px-5 py-4"
      style={{
        background: "var(--user-msg-bg)",
        borderLeft: "2.5px solid var(--border-strong)",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="section-label mb-2">
            You
          </p>
          <p
            className="whitespace-pre-wrap"
            style={{ lineHeight: 1.75, letterSpacing: "-0.01em", fontSize: 14 }}
          >
            {message.content}
          </p>
        </div>

        {message.checkpoint_ref && hovering && (
          <button
            onClick={handleRevert}
            className="p-1.5 rounded-md hover-bg flex-shrink-0 transition-colors"
            title="Revert to this checkpoint"
          >
            <RotateCcw size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
        )}
      </div>
    </div>
  );
});
