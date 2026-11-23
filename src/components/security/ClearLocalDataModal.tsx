import { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { wipeAllLocalData } from '../../utils/localDatabaseService';

interface ClearLocalDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleared?: () => void;
  wipe?: () => Promise<boolean>;
  language?: 'vi' | 'en';
}

export function ClearLocalDataModal({
  isOpen, onClose, onCleared, wipe = wipeAllLocalData, language = 'vi',
}: ClearLocalDataModalProps) {
  const title = useId();
  const description = useId();
  const [isWiping, setIsWiping] = useState(false);
  const [failed, setFailed] = useState(false);
  const vi = language === 'vi';

  if (!isOpen) return null;

  const close = () => {
    if (isWiping) return;
    setFailed(false);
    onClose();
  };

  const confirm = async () => {
    setIsWiping(true);
    setFailed(false);
    try {
      if (!await wipe()) {
        setFailed(true);
        return;
      }
      onCleared?.();
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-overlay p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby={title} aria-describedby={description}
        onKeyDown={(event) => { if (event.key === 'Escape') close(); }}
        className="w-full max-w-md rounded-xl border border-line bg-surface p-5 text-fg shadow-xl">
        <div className="flex items-center gap-2 text-down">
          <Trash2 className="h-5 w-5" aria-hidden />
          <h2 id={title} className="text-base font-bold">{vi ? 'Xóa dữ liệu trên máy?' : 'Clear local data?'}</h2>
        </div>
        <p id={description} className="mt-2 text-sm text-muted">
          {vi
            ? 'Báo cáo đã nhập, dữ liệu phân tích và lịch sử đã lưu của EcomPulse sẽ bị xóa khỏi trình duyệt này. Thao tác không thể hoàn tác.'
            : 'Imported reports, analysis data and saved EcomPulse history will be permanently removed from this browser.'}
        </p>
        {failed && <p role="alert" className="mt-3 rounded-control bg-down-soft p-2 text-sm text-down">{vi
          ? 'Chưa thể xác nhận đã xóa hết dữ liệu. Hãy đóng các tab EcomPulse khác rồi thử lại.'
          : 'The deletion could not be confirmed. Close other EcomPulse tabs and try again.'}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" autoFocus disabled={isWiping} onClick={close}
            className="min-h-10 rounded-md border border-line px-3 text-sm font-semibold hover:bg-hover disabled:opacity-50">
            {vi ? 'Hủy' : 'Cancel'}
          </button>
          <button id="confirm-clear-local-data" type="button" disabled={isWiping} onClick={confirm}
            className="min-h-10 rounded-md bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
            {isWiping ? (vi ? 'Đang xóa…' : 'Clearing…') : (vi ? 'Xóa dữ liệu' : 'Clear data')}
          </button>
        </div>
      </div>
    </div>
  );
}
