import express from 'express';
import bodyParser from 'body-parser';
import Rx from 'rx';
import { find } from 'lodash';
import processors from './processors';
import { isEvent } from './validators';
import config from './config';

const platforms = config.platforms.map(p => `x-${p}-event`);
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
  const event = headers[find(platforms, p => headers[p])];

  if (event) {
    onNext({ event, body });
    res.send('👍');
  } else {
    res.status(403).send('Forbidden');
  }
});

app.listen(3000);
