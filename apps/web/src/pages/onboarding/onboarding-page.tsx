import { OnboardingContainer } from '@/components/onboarding-container/onboarding-container'
import { useDocumentTitle } from '@/hooks/use-document-title'

export function OnboardingPage() {
  useDocumentTitle('はじめる')
  return <OnboardingContainer />
}
