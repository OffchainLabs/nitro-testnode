
export const stressOptions = {
    times: { number: true, description: 'times to repeat per thread', default: 1 },
    delay: { number: true, description: 'delay between repeats (ms)', default: 0 },
    threads: { number: true, default: 1 },
    threadId: { number: true, description: 'first thread-Id used', default: 0 },
    serial: { boolean: true, description: 'do all actions serially (e.g. when from is identical for all threads)', default: false }
}


export async function runStress(argv: any, commandHandler: (argv: any, thread: number) => Promise<void>) {
    const promiseArray: Array<Promise<void>> = []
    for (let threadIndex = 0; threadIndex < argv.threads; threadIndex++) {
        const threadPromise = commandHandler(argv, threadIndex + argv.threadId)
        if (argv.serial) {
            await threadPromise
        } else {
            promiseArray.push(threadPromise)
        }
    }
    const errors: any[] = []
    await Promise.all(promiseArray.map(p => p.catch((err: any) => { errors.push(err) })))
    if (errors.length > 0) {
        for (const err of errors) {
            console.error("Thread failure:", err)
        }
        throw new AggregateError(errors, `${errors.length} thread(s) failed`);
    }
}
