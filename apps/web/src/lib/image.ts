/**
 * アイコン画像のクライアント縮小 (F-01)。
 * 外部ストレージなし (0円構成) のため、アップロード前にブラウザで正方形96pxへ
 * カバークロップし、JPEG data URL (概ね3〜6KB) にしてDBへ保存する
 */
export const AVATAR_SIZE = 96

export async function resizeImageToAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2

    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      throw new Error('canvas 2d context が利用できません')
    }
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
