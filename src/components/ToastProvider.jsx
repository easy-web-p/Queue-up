import { useQueue } from '../context/QueueContext';

export function useToast() {
  const { addToast } = useQueue();
  return {
    warning: (msg) => addToast('แจ้งเตือน', msg, 'warning'),
    error: (msg) => addToast('เกิดข้อผิดพลาด', msg, 'error'),
    success: (msg) => addToast('สำเร็จ', msg, 'success'),
    info: (msg) => addToast('ข้อมูล', msg, 'info'),
  };
}

export default useToast;
