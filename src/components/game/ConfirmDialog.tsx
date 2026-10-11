import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface ConfirmRequest {
  title: ReactNode
  description?: ReactNode
  confirmText?: string
  tone?: 'gold' | 'blood' | 'mystic' | 'moss'
  onConfirm: () => void
}

/** 关键操作的二次确认弹窗：点任一按钮都会先关闭弹窗（onClose），确定时再执行 onConfirm */
export function ConfirmDialog({
  request,
  onClose,
  onCancel,
  cancelText = '取消',
}: {
  request: ConfirmRequest | null
  onClose: () => void
  /** 点取消时额外执行的操作 */
  onCancel?: () => void
  cancelText?: string
}) {
  return (
    <AlertDialog open={!!request}>
      {request && (
        <AlertDialogContent className="panel max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">{request.title}</AlertDialogTitle>
            {request.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2">
            <Button
              variant="stone"
              size="lg2"
              onClick={() => {
                onClose()
                onCancel?.()
              }}
            >
              {cancelText}
            </Button>
            <Button
              variant={request.tone ?? 'gold'}
              size="lg2"
              onClick={() => {
                onClose()
                request.onConfirm()
              }}
            >
              {request.confirmText ?? '确定'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
