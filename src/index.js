import express from 'express';
import bodyParser from 'body-parser';
import processors from './processors';
import Rx from 'rx';

const subject = new Rx.Subject();

processors.forEach(p => p(subject));

const app = express();
app.use(bodyParser.json());

app.post('/', ({ body, headers }, res) => {
  const event = headers['x-github-event'];

  const webhook = { event, body };
  subject.onNext(webhook);

  res.send('👍');
});

app.listen(3000);
