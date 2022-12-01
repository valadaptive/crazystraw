type QueueItem<T> = {
    resolve: (value: T | PromiseLike<T>) => unknown,
    reject: (error: unknown) => unknown,
    task: Task<T>
};

type Task<T> = () => Promise<T>;

class PromiseQueue {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private queue: QueueItem<any>[];

    private executing: boolean;

    constructor () {
        this.queue = [];
        this.executing = false;
    }

    public enqueue<T> (task: Task<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const item = {resolve, reject, task};
            this.queue.push(item);
            if (!this.executing) {
                this.executing = true;
                this.next();
            }
        });
    }

    private next (): void {
        const nextItem = this.queue.shift();
        if (!nextItem) {
            this.executing = false;
            return;
        }

        const {resolve, reject, task} = nextItem;

        task()
            .then(resolve, reject)
            .finally(this.next.bind(this));
    }
}

export default PromiseQueue;
