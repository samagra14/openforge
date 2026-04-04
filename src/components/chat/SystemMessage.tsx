import type { Message } from "../../stores/session";

interface Props {
  message: Message;
}

export function SystemMessage({ message }: Props) {
  return (
    <div className="system-message">
      {message.content}
    </div>
  );
}
