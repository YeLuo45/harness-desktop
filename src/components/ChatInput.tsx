import { useState, useRef, useEffect } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="input-area">
      <div className="input-container">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type your message...'}
            disabled={disabled}
            rows={1}
          />
        </div>
        <button
          className="send-btn"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          title="Send message"
        >
          ↑
        </button>
      </div>
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: 'flex',
        gap: '16px'
      }}>
        <span>Enter to send</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  )
}

export default ChatInput
