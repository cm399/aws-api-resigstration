import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {NextFunction, Request, Response} from 'express';
import {logger} from "../logger";

@Middleware({
    type: 'after',
    priority: 10
})
export class RequestLogger implements ExpressMiddlewareInterface {

    use(req: Request, res: Response, next: NextFunction) {
        logger.debug('RequestLogger:'+ `{"method":"${req.method}", "path":"${req.path}", "headers":${JSON.stringify(req.headers)},
        "params":${JSON.stringify(req.query)}, "body":${JSON.stringify(req.body ? req.body : null)}}`);
        const start = process.hrtime()

        res.on('finish', () => {            
            const durationInMilliseconds = getDurationInMilliseconds (start)
            logger.debug('RequestFinishLogger'+ `{"method":"${req.method}", "path":"${req.path}", "duration":${durationInMilliseconds .toLocaleString()} ms}`)
        })
    
        res.on('close', () => {
            const durationInMilliseconds = getDurationInMilliseconds (start)
            logger.debug('RequestCloseLogger'+ `{"method":"${req.method}", "path":"${req.path}", "duration":${durationInMilliseconds .toLocaleString()} ms}`)
        })

        next();
    }
}

const getDurationInMilliseconds = (start) => {
    const NS_PER_SEC = 1e9
    const NS_TO_MS = 1e6
    const diff = process.hrtime(start)

    return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS
}

