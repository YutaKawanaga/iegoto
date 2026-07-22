import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAppToast } from '@/hooks/use-app-toast'
import { useTRPC } from '@/lib/trpc'

/** VAPID 公開鍵 (base64url) を PushManager が要求する Uint8Array へ変換する */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Web Push の購読状態と通知設定 (F-08)。
 * iPhone はホーム画面に追加した PWA からのみ購読可能 (iOS 16.4+)
 */
export function usePushNotifications() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const toast = useAppToast()

  const statusQuery = useQuery(trpc.push.status.queryOptions())
  const invalidate = () => queryClient.invalidateQueries(trpc.push.pathFilter())

  const subscribeMutation = useMutation(
    trpc.push.subscribe.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success('この端末で通知を受け取ります')
      },
      onError: (e) => toast.error(e.message),
    }),
  )
  const unsubscribeMutation = useMutation(
    trpc.push.unsubscribe.mutationOptions({
      onSuccess: async () => {
        await invalidate()
        toast.success('この端末の通知を解除しました')
      },
      onError: (e) => toast.error(e.message),
    }),
  )
  const settingMutation = useMutation(
    trpc.push.updateSetting.mutationOptions({
      onSuccess: invalidate,
      onError: (e) => toast.error(e.message),
    }),
  )

  const enableOnThisDevice = async () => {
    const publicKey = statusQuery.data?.publicKey
    if (publicKey === undefined || publicKey === '') {
      toast.error('サーバー側の通知設定が未完了です')
      return
    }
    if (!isPushSupported()) {
      toast.error(
        'この環境では通知を使えません。iPhoneは「ホーム画面に追加」したiegotoから開いてください',
      )
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      toast.error('通知が許可されませんでした。端末の設定から許可できます')
      return
    }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
    const json = subscription.toJSON()
    if (json.endpoint === undefined || json.keys === undefined) {
      toast.error('購読情報の取得に失敗しました')
      return
    }
    subscribeMutation.mutate({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh ?? '',
      auth: json.keys.auth ?? '',
    })
  }

  const disableOnThisDevice = async () => {
    if (!isPushSupported()) {
      return
    }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription === null) {
      toast.error('この端末は通知を購読していません')
      return
    }
    await subscription.unsubscribe()
    unsubscribeMutation.mutate({ endpoint: subscription.endpoint })
  }

  return {
    isLoading: statusQuery.isLoading,
    configured: statusQuery.data?.configured ?? false,
    subscriptionCount: statusQuery.data?.subscriptionCount ?? 0,
    setting: statusQuery.data?.setting ?? {
      eventCreated: true,
      eventChanged: true,
      reminder: true,
    },
    supported: isPushSupported(),
    enableOnThisDevice,
    disableOnThisDevice,
    isSubscribing: subscribeMutation.isPending,
    updateSetting: (setting: { eventCreated: boolean; eventChanged: boolean; reminder: boolean }) =>
      settingMutation.mutate(setting),
  }
}
