import { useState, useRef, useCallback } from "react";

interface ChatInputProps {
  onSend: (text: string, images: File[]) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed && images.length === 0) return;
      onSend(trimmed, images);
      setText("");
      setImages([]);
      setPreviews([]);
      if (textRef.current) {
        textRef.current.style.height = "auto";
        textRef.current.focus();
      }
    },
    [text, images, onSend]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setImages((prev) => [...prev, ...files]);
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPreviews((prev) => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    []
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    },
    []
  );

  return (
    <div className="input-area">
      <form onSubmit={handleSubmit}>
        <div className="input-wrapper">
          {previews.length > 0 && (
            <div className="image-previews">
              {previews.map((src, i) => (
                <div key={i} className="image-preview">
                  <img src={src} alt={`upload ${i + 1}`} />
                  <button type="button" onClick={() => removeImage(i)}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="input-row">
            <button
              type="button"
              className="btn-attach"
              onClick={() => fileRef.current?.click()}
              title="Attach image"
            >
              +
            </button>
            <textarea
              ref={textRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Send a message..."
              rows={1}
              disabled={disabled}
            />
            <button
              type="submit"
              className="btn-send"
              disabled={disabled || (!text.trim() && images.length === 0)}
            >
              Send
            </button>
          </div>
        </div>
      </form>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}
