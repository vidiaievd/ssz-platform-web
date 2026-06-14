export function isSchedulingReady(): boolean {
  return process.env.SCHEDULING_BACKEND === 'real';
}
