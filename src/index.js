import express from 'express';
import bodyParser from 'body-parser';
import Rx from 'rx';
import processors from './processors';
import { isEvent } from './validators';

const subject = new Rx.Subject();

const onNext = (event, delay) => {
  if (isEvent(event)) {
    setTimeout(() => subject.onNext(event), delay);
  }
};

processors.forEach(p => p({ subject, onNext }));

const app = express();
app.use(bodyParser.json());

app.post('/', ({ body, headers }, res) => {
  const event = headers['x-github-event'];

  onNext({ event, body });

  res.send('👍');
});

app.listen(3000);
