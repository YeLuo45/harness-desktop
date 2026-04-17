import { useState, useEffect } from 'react'

interface HeaderProps {
  onSettingsClick: () => void
}

function Header({ onSettingsClick }: HeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      const electronAPI = (window as any).electronAPI
      if (electronAPI) {
        const maximized = await electronAPI.window.isMaximized()
        setIsMaximized(maximized)
      }
    }
    checkMaximized()
  }, [])

  const handleMinimize = async () => {
    const electronAPI = (window as any).electronAPI
    if (electronAPI) {
      await electronAPI.window.minimize()
    }
  }

  const handleMaximize = async () => {
    const electronAPI = (window as any).electronAPI
    if (electronAPI) {
      await electronAPI.window.maximize()
      const maximized = await electronAPI.window.isMaximized()
      setIsMaximized(maximized)
    }
  }

  const handleClose = async () => {
    const electronAPI = (window as any).electronAPI
    if (electronAPI) {
      await electronAPI.window.close()
    }
  }

  return (
    <header className="header">
      <div className="header-title">⚡ Harness Desktop</div>

      <div className="header-controls">
        <button
          className="header-btn"
          onClick={onSettingsClick}
          title="Settings"
        >
          ⚙
        </button>
        <button
          className="header-btn"
          onClick={handleMinimize}
          title="Minimize"
        >
          ─
        </button>
        <button
          className="header-btn"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? '❐' : '□'}
        </button>
        <button
          className="header-btn"
          onClick={handleClose}
          title="Close"
          style={{ color: '#f44336' }}
        >
          ✕
        </button>
      </div>
    </header>
  )
}

export default Header
