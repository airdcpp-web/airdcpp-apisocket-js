export interface PendingResult extends Pick<PromiseConstructor, 'resolve' | 'reject'> {
    promise: Promise<any>;
}
export interface AppPromise extends PromiseConstructor {
    pending: () => PendingResult;
}
declare const PendingPromise: AppPromise;
export default PendingPromise;
