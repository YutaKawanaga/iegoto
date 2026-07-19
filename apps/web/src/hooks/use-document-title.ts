import { useEffect } from 'react'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | iegoto`
    return () => {
      document.title = 'iegoto'
    }
  }, [title])
}
